# =============================================
# ProGuard rules — Capacitor Android
# Release 构建时必须保留反射调用的类名/方法名
# 否则 Capacitor bridge 和插件初始化会失败
# =============================================

# ---------- Capacitor core ----------
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.Plugin { *; }
-keep class com.getcapacitor.PluginMethod { *; }
-keep class com.getcapacitor.JSObject { *; }

# ---------- WebView JS bridge 反射 ----------
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
}

# ---------- 官方扫码插件 @capacitor/barcode-scanner ----------
-keep class com.outsystems.** { *; }
-keep class com.capacitorjs.barcodescanner.** { *; }
-dontwarn com.outsystems.**

# ---------- ML Kit barcode scanning ----------
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# ---------- ZXing (可能被插件间接依赖) ----------
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**

# ---------- Kotlin 运行时 (release 不混淆 Kotlin) ----------
-keep class kotlin.** { *; }
-keep class kotlinx.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**

# ---------- WebView 相关 ----------
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ---------- 保留行号 (崩溃栈定位用) ----------
-keepattributes SourceFile,LineNumberTable
