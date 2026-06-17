package com.lyauto.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lyauto.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;

/**
 * 防比价构图模板库：存 userDataDir/antiprice-templates.json，前端可增删改、运行时即时生效。
 * 首次不存在时从 classpath 默认模板（prompt/antiprice-templates.json）落地一份。
 */
@Service
public class PromptTemplateService {

    private static final Logger log = LoggerFactory.getLogger(PromptTemplateService.class);
    private final AppProperties appProperties;
    private final ObjectMapper om = new ObjectMapper();

    public PromptTemplateService(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    private File templateFile() {
        return new File(appProperties.getPaths().getUserDataDir(), "antiprice-templates.json");
    }

    /** 读模板库 JSON 文本；不存在则从 classpath 默认值落地后再读。 */
    public synchronized String loadJson() {
        File f = templateFile();
        try {
            if (!f.isFile()) {
                String def = PromptLoader.load("prompt/antiprice-templates.json");
                f.getParentFile().mkdirs();
                Files.write(f.toPath(), def.getBytes(StandardCharsets.UTF_8));
                return def;
            }
            return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("读取防比价模板失败，回退默认: {}", e.getMessage());
            try { return PromptLoader.load("prompt/antiprice-templates.json"); }
            catch (Exception e2) { return "{\"templates\":[]}"; }
        }
    }

    /** 保存模板库 JSON（前端编辑后写回）。 */
    public synchronized void saveJson(String json) throws Exception {
        File f = templateFile();
        f.getParentFile().mkdirs();
        Files.write(f.toPath(), json.getBytes(StandardCharsets.UTF_8));
    }

    /** 返回模板列表（List<Map>）。失败返回空列表。 */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listTemplates() {
        try {
            Map<String, Object> root = om.readValue(loadJson(), Map.class);
            Object t = root.get("templates");
            if (t instanceof List) return (List<Map<String, Object>>) t;
        } catch (Exception e) { log.warn("解析模板失败: {}", e.getMessage()); }
        return new java.util.ArrayList<>();
    }

    /** 按 id 取单个模板；找不到返回 null。 */
    public Map<String, Object> findById(String id) {
        if (id == null || id.isBlank()) return null;
        for (Map<String, Object> t : listTemplates()) {
            if (id.equals(String.valueOf(t.get("id")))) return t;
        }
        return null;
    }
}
