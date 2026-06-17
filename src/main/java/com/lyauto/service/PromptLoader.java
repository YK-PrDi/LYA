package com.lyauto.service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * 从 classpath 读取 prompt 模板文件。
 * 模板放在 src/main/resources/prompt/*.txt，打包后自动进入 classpath。
 */
public class PromptLoader {

    private PromptLoader() {}

    /**
     * 读取 classpath 下的 prompt 模板全文（UTF-8）。
     * @param resourcePath 相对 classpath 路径，如 "prompt/image-sku-white-bg.txt"
     */
    public static String load(String resourcePath) {
        try (InputStream is = PromptLoader.class.getClassLoader()
                .getResourceAsStream(resourcePath)) {
            if (is == null) {
                throw new RuntimeException("prompt 文件未找到: " + resourcePath);
            }
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("读取 prompt 失败: " + resourcePath, e);
        }
    }
}
