-- Felix Radio - Add Qwen3 STT result path
-- Version: 2.0
-- Description: Secondary STT engine (OpenRouter qwen3-asr-1.7b) text path

ALTER TABLE recordings ADD COLUMN stt_qwen3_text_path TEXT;
