package com.lyauto.service;

import com.lyauto.config.AppProperties;
import com.lyauto.model.GenerationTask;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.Iterator;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
public class TaskService {

    private static final Logger log = LoggerFactory.getLogger(TaskService.class);

    // 任务完成后保留 60 分钟，之后清理避免 OOM
    private static final long DONE_TASK_TTL_MS = 60 * 60 * 1000L;
    // 临时归档保留 2 小时
    private static final long TEMP_OUTPUT_TTL_MS = 2 * 60 * 60 * 1000L;

    private final AppProperties appProperties;

    private final ExecutorService executor = Executors.newFixedThreadPool(10);
    private final Map<String, GenerationTask> tasks = new ConcurrentHashMap<>();
    private final Map<String, Long> completedAt = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleaner =
            Executors.newSingleThreadScheduledExecutor(r -> {
                Thread t = new Thread(r, "task-cleaner");
                t.setDaemon(true);
                return t;
            });

    public TaskService(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    @PostConstruct
    void start() {
        cleaner.scheduleAtFixedRate(this::evictExpired, 5, 5, TimeUnit.MINUTES);
        cleaner.scheduleAtFixedRate(this::evictExpiredTempOutput, 1, 30, TimeUnit.MINUTES);
    }

    public GenerationTask createTask(int total) {
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        GenerationTask task = new GenerationTask(id, total);
        tasks.put(id, task);
        return task;
    }

    public void submit(GenerationTask task, Runnable work) {
        executor.submit(() -> {
            task.setStatus("running");
            try {
                work.run();
            } catch (Exception e) {
                log.error("任务 {} 执行异常: {}", task.getId(), e.getMessage(), e);
                task.setStatus("error");
                completedAt.put(task.getId(), System.currentTimeMillis());
                return;
            }
            task.setStatus(task.isCancelled() ? "stopped" : "done");
            completedAt.put(task.getId(), System.currentTimeMillis());
        });
    }

    public Optional<GenerationTask> getTask(String taskId) {
        return Optional.ofNullable(tasks.get(taskId));
    }

    public boolean cancel(String taskId) {
        GenerationTask task = tasks.get(taskId);
        if (task == null) return false;
        task.cancel();
        return true;
    }

    private void evictExpired() {
        long now = System.currentTimeMillis();
        int removed = 0;
        Iterator<Map.Entry<String, Long>> it = completedAt.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Long> e = it.next();
            if (now - e.getValue() > DONE_TASK_TTL_MS) {
                tasks.remove(e.getKey());
                it.remove();
                removed++;
            }
        }
        if (removed > 0) log.debug("TaskService 清理过期任务: {} 条", removed);
    }

    private void evictExpiredTempOutput() {
        try {
            String tempDir = appProperties.getPaths().getTempOutputDir();
            if (tempDir == null || tempDir.isBlank()) return;
            File root = new File(tempDir);
            if (!root.isDirectory()) return;
            long cutoff = System.currentTimeMillis() - TEMP_OUTPUT_TTL_MS;
            int removed = 0;
            File[] topLevel = root.listFiles(File::isDirectory);
            if (topLevel == null) return;
            for (File top : topLevel) {
                File[] subDirs = top.listFiles(File::isDirectory);
                if (subDirs == null) continue;
                for (File sub : subDirs) {
                    if (sub.lastModified() < cutoff) {
                        if (deleteRecursively(sub)) removed++;
                    }
                }
                File[] files = top.listFiles(File::isFile);
                if (files != null) {
                    for (File f : files) {
                        if (f.lastModified() < cutoff && f.delete()) removed++;
                    }
                }
            }
            if (removed > 0) log.info("临时归档清理: 删了 {} 个过期目录/文件", removed);
        } catch (Exception e) {
            log.warn("临时归档清理失败: {}", e.getMessage());
        }
    }

    private boolean deleteRecursively(File file) {
        if (file == null || !file.exists()) return false;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File c : children) deleteRecursively(c);
        }
        return file.delete();
    }
}
