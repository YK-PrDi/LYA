package com.lyauto.model;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

public class GenerationTask {

    private final String id;
    /** pending / running / done / stopped / error */
    private volatile String status = "pending";
    private volatile int progress = 0;
    private volatile int total;
    private volatile boolean cancelled = false;
    private volatile String currentProduct = "";
    private final List<Map<String, Object>> results = new CopyOnWriteArrayList<>();
    private final long createdAt = System.currentTimeMillis();

    public GenerationTask(String id, int total) {
        this.id = id;
        this.total = total;
    }

    public String getId() { return id; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getProgress() { return progress; }
    public void incrementProgress() { this.progress++; }
    public int getTotal() { return total; }
    public boolean isCancelled() { return cancelled; }
    public void cancel() { this.cancelled = true; }
    public String getCurrentProduct() { return currentProduct; }
    public void setCurrentProduct(String p) { this.currentProduct = p; }
    public List<Map<String, Object>> getResults() { return results; }
    public void addResult(Map<String, Object> r) { results.add(r); }
    public long getCreatedAt() { return createdAt; }
}
