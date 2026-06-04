package com.lyauto.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private Volcengine volcengine = new Volcengine();
    private Paths paths = new Paths();
    private Auth auth = new Auth();

    public Volcengine getVolcengine() { return volcengine; }
    public void setVolcengine(Volcengine volcengine) { this.volcengine = volcengine; }
    public Paths getPaths() { return paths; }
    public void setPaths(Paths paths) { this.paths = paths; }
    public Auth getAuth() { return auth; }
    public void setAuth(Auth auth) { this.auth = auth; }

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
}
