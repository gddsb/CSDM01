package com.daman.milkcanmes;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import android.os.Environment;

@CapacitorPlugin(name = "InstallApk")
public class InstallApkPlugin extends Plugin {

    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";
    private static final String FILEPROVIDER_AUTHORITY = "com.daman.milkcanmes.fileprovider";

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        String directory = call.getString("directory", "Cache");

        if (path == null || path.isEmpty()) {
            call.reject("path is required");
            return;
        }

        try {
            Context ctx = getContext();
            File apkFile;

            if ("External".equals(directory)) {
                apkFile = new File(Environment.getExternalStorageDirectory(), path);
            } else if ("Documents".equals(directory)) {
                apkFile = new File(ctx.getFilesDir(), path);
            } else {
                // 默认 Cache 目录
                apkFile = new File(ctx.getCacheDir(), path);
            }

            if (!apkFile.exists()) {
                call.reject("APK file not found: " + apkFile.getAbsolutePath());
                return;
            }

            Uri apkUri = FileProvider.getUriForFile(
                ctx,
                FILEPROVIDER_AUTHORITY,
                apkFile
            );

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, APK_MIME_TYPE);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            ctx.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("path", apkFile.getAbsolutePath());
            ret.put("uri", apkUri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to launch installer: " + e.getMessage(), e);
        }
    }
}
