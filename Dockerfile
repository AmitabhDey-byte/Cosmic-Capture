FROM python:3.12-slim AS production

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY db ./db

EXPOSE 3001

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "3001"]
