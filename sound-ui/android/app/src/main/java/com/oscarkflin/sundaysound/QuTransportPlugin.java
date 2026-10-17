package com.oscarkflin.sundaysound;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.util.Base64;
import java.net.*;
import java.io.*;
import java.util.concurrent.*;
import org.json.*;

@CapacitorPlugin(name="QuTransport")
public class QuTransportPlugin extends Plugin {
    private final ExecutorService writer=Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService clock=Executors.newSingleThreadScheduledExecutor();
    private volatile Socket socket;
    private volatile long lastRx;
    private volatile int generation=0;
    private volatile boolean connecting=false;
    private ScheduledFuture<?> heartbeat;
    @Override public void load(){QuDiagnostics.init(getContext());}
    private void event(String state,String reason){JSObject value=new JSObject();value.put("state",state);value.put("reason",reason);notifyListeners("status",value);QuDiagnostics.record("connection."+state,reason);}
    private synchronized void close(String reason){generation++;connecting=false;if(heartbeat!=null){heartbeat.cancel(false);heartbeat=null;}Socket old=socket;socket=null;if(old!=null)try{old.close();}catch(IOException ignored){}event("disconnected",reason);}
    @PluginMethod public void disconnect(PluginCall call){close("Disconnected by operator");call.resolve();}
    @PluginMethod public void connect(PluginCall call){
        String host=call.getString("host","");
        if(!host.matches("(?:\\d{1,3}\\.){3}\\d{1,3}")){call.reject("Enter the mixer IPv4 address");return;}
        for(String part:host.split("\\."))if(Integer.parseInt(part)>255){call.reject("Invalid IPv4 address");return;}
        close("Starting a new connection");final int ticket=generation;connecting=true;event("connecting","Opening TCP port 51325");
        QuDiagnostics.record("connection.target",host.equals("127.0.0.1")?"Local loopback / USB test endpoint":"Operator-entered LAN address");
        writer.execute(()->{
            Socket candidate=new Socket();
            try {
                candidate.connect(new InetSocketAddress(host,51325),5000);candidate.setTcpNoDelay(true);candidate.setSoTimeout(1000);
                synchronized(this){if(ticket!=generation){candidate.close();call.reject("Connection cancelled");return;}socket=candidate;connecting=false;lastRx=System.currentTimeMillis();
                    heartbeat=clock.scheduleAtFixedRate(()->{if(socket!=candidate)return;if(System.currentTimeMillis()-lastRx>6000){close("No data from mixer for 6 seconds");return;}try{write(candidate,new byte[]{(byte)0xFE});}catch(IOException e){close("Heartbeat failed: "+e.getMessage());}},300,300,TimeUnit.MILLISECONDS);
                }
                event("socket-open","TCP open; awaiting Qu identity and state");call.resolve();
                new Thread(()->read(candidate),"qu-midi-reader").start();
            }catch(Exception e){try{candidate.close();}catch(IOException ignored){}if(ticket==generation)close("Connect failed: "+e.getMessage());QuDiagnostics.record("connection.error",e.toString());call.reject("Cannot reach mixer: "+e.getMessage());}
        });
    }
    private void read(Socket active){byte[] bytes=new byte[4096];try{InputStream input=active.getInputStream();while(socket==active){try{int length=input.read(bytes);if(length<0)throw new EOFException("Mixer closed TCP connection");lastRx=System.currentTimeMillis();boolean onlyHeartbeat=true;for(int i=0;i<length;i++)if((bytes[i]&255)!=254)onlyHeartbeat=false;
                    if(!onlyHeartbeat){QuDiagnostics.record("tcp.rx",hex(bytes,length));JSObject data=new JSObject();data.put("base64",Base64.encodeToString(bytes,0,length,Base64.NO_WRAP));notifyListeners("data",data);}
                }catch(SocketTimeoutException ignored){}}
            }catch(Exception e){if(socket==active)close("Read failed: "+e.getMessage());}
    }
    private synchronized void write(Socket target,byte[] data)throws IOException {if(socket!=target)throw new IOException("Connection changed");target.getOutputStream().write(data);target.getOutputStream().flush();if(data.length!=1)QuDiagnostics.record("tcp.tx",hex(data,data.length));}
    private String hex(byte[] bytes,int length){StringBuilder s=new StringBuilder();for(int i=0;i<Math.min(length,4096);i++)s.append(String.format("%02X ",bytes[i]&255));return s.toString();}
    // Deliberately allow only state requests, input mutes, and LR input faders.
    private boolean allowed(byte[] b){
        int[] request={240,0,0,26,80,17,1,0,127,16,0,247};
        if(b.length==12){boolean match=true;for(int i=0;i<12;i++)if((b[i]&255)!=request[i])match=false;if(match)return true;}
        if(b.length==6){int s=b[0]&255,ch=b[1]&255;return s>=144&&s<=159&&input(ch)&&(b[2]==127||b[2]==63)&&b[3]==b[0]&&b[4]==b[1]&&b[5]==0;}
        if(b.length==12){int s=b[0]&255;return s>=176&&s<=191&&b[1]==99&&input(b[2]&255)&&b[3]==b[0]&&b[4]==98&&b[5]==23&&b[6]==b[0]&&b[7]==6&&(b[8]&255)<=127&&b[9]==b[0]&&b[10]==38&&b[11]==7;}
        return false;
    }
    private boolean input(int ch){return (ch>=32&&ch<=55)||(ch>=64&&ch<=66)||(ch>=8&&ch<=11);}
    @PluginMethod public void send(PluginCall call){
        try{JSArray values=call.getArray("bytes");if(values==null||values.length()>12)throw new Exception("Invalid MIDI packet");byte[] bytes=new byte[values.length()];for(int i=0;i<bytes.length;i++){int v=values.getInt(i);if(v<0||v>255)throw new Exception("Invalid MIDI byte");bytes[i]=(byte)v;}if(!allowed(bytes))throw new Exception("Unsupported MIDI command");Socket target=socket;if(target==null)throw new Exception("Mixer disconnected");
            writer.execute(()->{try{write(target,bytes);call.resolve();}catch(Exception e){QuDiagnostics.record("command.error",e.toString());if(socket==target)close("Write failed: "+e.getMessage());call.reject(e.getMessage());}});
        }catch(Exception e){call.reject(e.getMessage());}
    }
    @PluginMethod public void diagnostics(PluginCall call){JSObject result=new JSObject();result.put("events",QuDiagnostics.read(Boolean.TRUE.equals(call.getBoolean("raw",false))));result.put("android",android.os.Build.VERSION.RELEASE);result.put("model",android.os.Build.MODEL);call.resolve(result);}
    @Override protected void handleOnPause(){if(socket!=null||connecting)close("App left the foreground; reconnect to resynchronize");}
    @Override protected void handleOnDestroy(){close("App destroyed");writer.shutdownNow();clock.shutdownNow();}
}
