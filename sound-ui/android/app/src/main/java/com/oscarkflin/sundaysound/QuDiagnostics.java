package com.oscarkflin.sundaysound;

import android.content.Context;
import android.util.Log;
import org.json.*;
import java.io.*;

public final class QuDiagnostics {
    private static Context context;
    private static boolean initialized;
    public static synchronized void init(Context ctx) {
        context=ctx.getApplicationContext();
        if(initialized)return;
        initialized=true;
        Thread.UncaughtExceptionHandler previous=Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread,error)->{
            record("native.crash",Log.getStackTraceString(error));
            if(previous!=null)previous.uncaughtException(thread,error);
        });
        record("native.started",android.os.Build.MANUFACTURER+" "+android.os.Build.MODEL+" Android "+android.os.Build.VERSION.RELEASE);
    }
    public static synchronized void record(String event,String detail) {
        if(context==null)return;
        try {
            File file=new File(context.getFilesDir(),"qu-trace.jsonl");
            if(file.length()>1024*1024){File old=new File(context.getFilesDir(),"qu-trace.previous.jsonl");if(old.exists())old.delete();file.renameTo(old);}
            JSONObject row=new JSONObject();row.put("at",System.currentTimeMillis());row.put("event",event);row.put("detail",detail.length()>20000?detail.substring(0,20000):detail);
            try(FileWriter writer=new FileWriter(file,true)){writer.write(row.toString()+"\n");}
        }catch(Exception e){Log.e("SundaySound","Unable to record diagnostic",e);}
    }
    public static synchronized JSONArray read(boolean raw) {
        JSONArray rows=new JSONArray();if(context==null)return rows;
        for(String name:new String[]{"qu-trace.previous.jsonl","qu-trace.jsonl"}){
            try(BufferedReader reader=new BufferedReader(new FileReader(new File(context.getFilesDir(),name)))){
                String line;while((line=reader.readLine())!=null){try{JSONObject row=new JSONObject(line);String event=row.optString("event");if(!raw&&(event.equals("tcp.rx")||event.equals("tcp.tx")))continue;row.put("detail",row.optString("detail").replaceAll("\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b","[address removed]"));rows.put(row);}catch(JSONException ignored){}}
            }catch(IOException ignored){}
        }
        return rows;
    }
}
