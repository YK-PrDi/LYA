package com.lyauto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private Volcengine volcengine = new Volcengine();
    private Paths paths = new Paths();
    private Auth auth = new Auth();
    private Kuaimai kuaimai = new Kuaimai();
    private GptImage gptImage = new GptImage();

    public Volcengine getVolcengine() { return volcengine; }
    public void setVolcengine(Volcengine volcengine) { this.volcengine = volcengine; }
    public Paths getPaths() { return paths; }
    public void setPaths(Paths paths) { this.paths = paths; }
    public Auth getAuth() { return auth; }
    public void setAuth(Auth auth) { this.auth = auth; }
    public Kuaimai getKuaimai() { return kuaimai; }
    public void setKuaimai(Kuaimai kuaimai) { this.kuaimai = kuaimai; }
    public GptImage getGptImage() { return gptImage; }
    public void setGptImage(GptImage gptImage) { this.gptImage = gptImage; }

    public static class Volcengine {
        private String apiKey;
        private String baseUrl = "https://ark.cn-beijing.volces.com/api/v3";
        private String model = "doubao-seedance-2-0-260128";

        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
    }

    public static class Paths {
        // 打包态由 electron 经 -Dapp.paths.user-data-dir=... 注入；源码态留空则 fallback "./"
        private String userDataDir = "./";
        // TaskService 临时归档清理用（上新模式实际用不到，给默认值）
        private String tempOutputDir = "./.temp-output";

        public String getUserDataDir() { return userDataDir; }
        public void setUserDataDir(String userDataDir) { this.userDataDir = userDataDir; }
        public String getTempOutputDir() { return tempOutputDir; }
        public void setTempOutputDir(String tempOutputDir) { this.tempOutputDir = tempOutputDir; }
    }

    public static class Auth {
        private String password = "123456";

        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }

    public static class Kuaimai {
        private String appKey = "";
        private String appSecret = "";
        private String accessToken = "";
        private String refreshToken = "";

        public String getAppKey() { return appKey; }
        public void setAppKey(String appKey) { this.appKey = appKey; }
        public String getAppSecret() { return appSecret; }
        public void setAppSecret(String appSecret) { this.appSecret = appSecret; }
        public String getAccessToken() { return accessToken; }
        public void setAccessToken(String accessToken) { this.accessToken = accessToken; }
        public String getRefreshToken() { return refreshToken; }
        public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }
    }

    public static class GptImage {
        /** provider: gemini | openai */
        private String provider = "gemini";
        private String baseUrl = "https://generativelanguage.googleapis.com";
        private String model = "gemini-2.5-flash-image";
        /** 逗号分隔的多个密钥，轮换使用 */
        private String keys = "";
        /** 可选 HTTP 代理（如 127.0.0.1:8086），为空则直连 */
        private String proxyHost = "";
        private int proxyPort = 0;

        public String getProvider() { return provider; }
        public void setProvider(String provider) { this.provider = provider; }
        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public String getKeys() { return keys; }
        public void setKeys(String keys) { this.keys = keys; }
        public String getProxyHost() { return proxyHost; }
        public void setProxyHost(String proxyHost) { this.proxyHost = proxyHost; }
        public int getProxyPort() { return proxyPort; }
        public void setProxyPort(int proxyPort) { this.proxyPort = proxyPort; }

        public java.util.List<String> keyList() {
            java.util.List<String> out = new java.util.ArrayList<>();
            if (keys != null) {
                for (String k : keys.split(",")) {
                    String t = k.trim();
                    if (!t.isEmpty()) out.add(t);
                }
            }
            return out;
        }
    }
}
