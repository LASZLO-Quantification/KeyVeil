FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV KEYVEIL_HOST=0.0.0.0
ENV PORT=8765

RUN useradd --create-home --uid 10001 appuser

COPY pyproject.toml README.md LICENSE ./
COPY src ./src
COPY demo ./demo

RUN pip install --no-cache-dir ".[demo]"

USER appuser

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT','8765') + '/health', timeout=2)"

CMD ["python", "-m", "demo.web_server"]
