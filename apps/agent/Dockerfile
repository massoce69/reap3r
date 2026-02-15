# ─────────────────────────────────────────────────────────────
# MASSVISION Reap3r - Rust Agent Dockerfile (Multi-stage)
# ─────────────────────────────────────────────────────────────

# Stage 1: Build
FROM rust:1.78-bookworm AS builder

WORKDIR /usr/src/app
COPY . .

RUN cargo build --release

# Stage 2: Production (minimal)
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash massvision

COPY --from=builder /usr/src/app/target/release/massvision-agent /usr/local/bin/massvision-agent

RUN mkdir -p /etc/massvision/reap3r && \
    chown massvision:massvision /etc/massvision/reap3r

USER massvision

ENTRYPOINT ["massvision-agent"]
