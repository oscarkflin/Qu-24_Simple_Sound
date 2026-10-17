package com.oscarkflin.sundaysound;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.util.Base64;
import android.net.*;
import android.content.Context;
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
    private volatile boolean discovering=false;
    private volatile int discoveryGeneration=0;
    // Bounded Wi-Fi-only port discovery. No MIDI or mixer-setting packets are sent.
    @PluginMethod public synchronized void discover(PluginCall call){
        if(discovering||connecting||socket!=null){call.reject("Disconnect before searching for mixers");return;}
        ConnectivityManager cm=(ConnectivityManager)getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        Network selected=null;LinkAddress local=null;
        for(Network network:cm.getAllNetworks()){
            NetworkCapabilities caps=cm.getNetworkCapabilities(network);
            LinkProperties props=cm.getLinkProperties(network);
            if(caps==null||props==null||!caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)||caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN))continue;
            for(LinkAddress address:props.getLinkAddresses())if(address.getAddress() instanceof Inet4Address&&!address.getAddress().isLinkLocalAddress()){selected=network;local=address;break;}
            if(local!=null)break;
        }
        if(local==null){call.reject("Connect to the church Wi-Fi first (a mixer internet connection is not required)");return;}
        final Network wifi=selected;
        final byte[] address=local.getAddress().getAddress();
        final int prefix=local.getPrefixLength();
        if(prefix>30){call.reject("This Wi-Fi network has no searchable local subnet. Use manual IP entry.");return;}
        final int scanPrefix=Math.max(24,prefix);
        final int own=((address[0]&255)<<24)|((address[1]&255)<<16)|((address[2]&255)<<8)|(address[3]&255);
        final int base=own&(-1<<(32-scanPrefix));
        final int count=1<<(32-scanPrefix);
        final int ticket=++discoveryGeneration;discovering=true;
        QuDiagnostics.record("discovery.started","Wi-Fi only; TCP 51325; at most 254 hosts; no MIDI sent; prefix /"+scanPrefix);
        new Thread(()->{
            ExecutorService probes=Executors.newFixedThreadPool(16);
            java.util.List<String> found=java.util.Collections.synchronizedList(new java.util.ArrayList<>());
            try{
                java.util.List<Future<?>> tasks=new java.util.ArrayList<>();
                for(int offset=1;offset<count-1;offset++){
                    final int target=base+offset;if(target==own)continue;
                    tasks.add(probes.submit(()->{
                        if(ticket!=discoveryGeneration)return;
                        String host=((target>>>24)&255)+"."+((target>>>16)&255)+"."+((target>>>8)&255)+"."+(target&255);
                        try(Socket probe=wifi.getSocketFactory().createSocket()){
                            probe.connect(new InetSocketAddress(host,51325),400);
                            if(ticket==discoveryGeneration)found.add(host);
                        }catch(IOException ignored){}
                    }));
                }
                for(Future<?> task:tasks)task.get();
                if(ticket!=discoveryGeneration){call.reject("Mixer search cancelled");return;}
                java.util.Collections.sort(found);
                JSObject result=new JSObject();JSArray hosts=new JSArray();for(String host:found)hosts.put(host);
                result.put("hosts",hosts);result.put("limited",prefix<24);
                QuDiagnostics.record("discovery.completed","Candidates="+found.size()+"; limited="+(prefix<24));call.resolve(result);
            }catch(Exception e){QuDiagnostics.record("discovery.error",e.toString());call.reject("Mixer search failed. Try the manual IP address.");}
            finally{probes.shutdownNow();discovering=false;}
        },"qu-wifi-discovery").start();
    }
    private ScheduledFuture<?> heartbeat;
    @Override public void load(){QuDiagnostics.init(getContext());}
    private void event(String state,String reason){JSObject value=new JSObject();value.put("state",state);value.put("reason",reason);notifyListeners("status",value);QuDiagnostics.record("connection."+state,reason);}
    private synchronized void close(String reason){generation++;connecting=false;if(heartbeat!=null){heartbeat.cancel(false);heartbeat=null;}Socket old=socket;socket=null;if(old!=null)try{old.close();}catch(IOException ignored){}event("disconnected",reason);}
    @PluginMethod public void disconnect(PluginCall call){close("Disconnected by operator");call.resolve();}
    @PluginMethod public void connect(PluginCall call){
        if(discovering){call.reject("Wait for mixer search to finish");return;}
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
    @Override protected void handleOnPause(){discoveryGeneration++;if(socket!=null||connecting)close("App left the foreground; reconnect to resynchronize");}
    @Override protected void handleOnDestroy(){discoveryGeneration++;close("App destroyed");writer.shutdownNow();clock.shutdownNow();}
}
