package com.lyauto.controller;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;

/**
 * 按绝对路径返回本地图片字节，供前端 SKU/主图缩略图预览。
 */
@RestController
public class ResourceController {

    @GetMapping("/api/image")
    public ResponseEntity<FileSystemResource> getImage(@RequestParam String path) {
        File file = new File(path);
        if (!file.exists() || !file.isFile()) return ResponseEntity.notFound().build();
        String lower = path.toLowerCase();
        String mimeType = lower.endsWith(".png") ? "image/png"
                        : lower.endsWith(".webp") ? "image/webp"
                        : "image/jpeg";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mimeType))
                .body(new FileSystemResource(file));
    }
}
