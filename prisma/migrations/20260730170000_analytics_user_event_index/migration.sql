-- CreateIndex
CREATE INDEX "analytics_events_user_id_event_name_occurred_at_idx"
  ON "analytics_events"("user_id", "event_name", "occurred_at");
