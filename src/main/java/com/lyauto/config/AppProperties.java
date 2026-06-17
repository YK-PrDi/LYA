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
        /** provider: gemini | openai（openai 走 gpt-image-2） */
        private String provider = "gemini";
        /** Gemini: https://generativelanguage.googleapis.com ; OpenAI: https://api.linapi.net */
        private String baseUrl = "https://generativelanguage.googleapis.com";
        /** Gemini: gemini-2.5-flash-image ; OpenAI: gpt-image-2 */
        private String model = "gemini-2.5-flash-image";
        /** Gemini 路径：逗号分隔的多个密钥，轮换使用 */
        private String keys = "";
        /** OpenAI 路径：多个 API Key 列表（YAML 数组注入），每个 key 独立轮换 */
        private java.util.List<String> apiKeys = new java.util.ArrayList<>();
        /** 可选 HTTP 代理（如 127.0.0.1:8086），为空则直连 */
        private String proxyHost = "";
        private int proxyPort = 0;
        /** Gemini 生图宽高比枚举（ASPECT_RATIO_ONE_BY_ONE / ASPECT_RATIO_SIXTEEN_BY_NINE 等），仅 gemini 路径生效 */
        private String aspectRatio = "ASPECT_RATIO_ONE_BY_ONE";
        /** Gemini 生图分辨率枚举（IMAGE_SIZE_ONE_K / IMAGE_SIZE_TWO_K / IMAGE_SIZE_FOUR_K），仅 gemini 路径生效 */
        private String imageSize = "IMAGE_SIZE_ONE_K";

        public String getProvider() { return provider; }
        public void setProvider(String provider) { this.provider = provider; }
        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model; }
        public String getKeys() { return keys; }
        public void setKeys(String keys) { this.keys = keys; }
        public java.util.List<String> getApiKeys() { return apiKeys; }
        public void setApiKeys(java.util.List<String> apiKeys) { this.apiKeys = apiKeys; }
        public String getProxyHost() { return proxyHost; }
        public void setProxyHost(String proxyHost) { this.proxyHost = proxyHost; }
        public int getProxyPort() { return proxyPort; }
        public void setProxyPort(int proxyPort) { this.proxyPort = proxyPort; }
        public String getAspectRatio() { return aspectRatio; }
        public void setAspectRatio(String aspectRatio) { this.aspectRatio = aspectRatio; }
        public String getImageSize() { return imageSize; }
        public void setImageSize(String imageSize) { this.imageSize = imageSize; }

        /**
         * 返回可轮换的密钥列表。
         * OpenAI 路径优先用 apiKeys（列表），为空则 fallback 到 keys（逗号分隔，Gemini 路径）。
         */
        public java.util.List<String> keyList() {
            // 先收集 apiKeys 里的非空项（OpenAI 路径优先）
            java.util.List<String> out = new java.util.ArrayList<>();
            if (apiKeys != null) {
                for (String k : apiKeys) {
                    if (k == null) continue;
                    String t = k.trim();
                    if (!t.isEmpty()) out.add(t);
                }
            }
            if (!out.isEmpty()) return out;
            // apiKeys 全空（如未注入环境变量）时回退到 keys（逗号分隔，Gemini 路径）
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
