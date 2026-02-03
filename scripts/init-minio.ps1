# Requires MinIO Client (mc)
mc alias set local http://localhost:9000 minio minio123
mc mb --ignore-existing local/hostea
