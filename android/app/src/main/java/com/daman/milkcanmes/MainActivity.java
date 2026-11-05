package com.daman.milkcanmes;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 本地 Java 插件必须显式注册，Capacitor 不会自动注册 app 包内的插件
        registerPlugin(InstallApkPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
