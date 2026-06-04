package com.lyauto.controller;

import com.lyauto.service.TaskService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 异步任务进度查询与停止。
 * 从 ApiController 拆出（A.1 重构），业务逻辑零变动。
 */
@RestController
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    /** 查询任务状态 */
    @GetMapping("/api/task/{taskId}")
    public ResponseEntity<Map<String, Object>> getTaskStatus(@PathVariable String taskId) {
        return taskService.getTask(taskId)
                .map(task -> {
                    Map<String, Object> resp = new LinkedHashMap<>();
                    resp.put("taskId", task.getId());
                    resp.put("status", task.getStatus());
                    resp.put("progress", task.getProgress());
                    resp.put("total", task.getTotal());
                    resp.put("currentProduct", task.getCurrentProduct());
                    resp.put("results", task.getResults());
                    return ResponseEntity.ok(resp);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /** 停止任务 */
    @PostMapping("/api/task/{taskId}/stop")
    public ResponseEntity<Map<String, Object>> stopTask(@PathVariable String taskId) {
        boolean ok = taskService.cancel(taskId);
        return ResponseEntity.ok(Map.of("success", ok));
    }
}
