from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_ORIGINS
from app.routes.students import router as students_router
from app.routes.rfid import router as rfid_router
from app.routes.attendance import router as attendance_router


app = FastAPI(
    title="Student RFID Attendance System",
    description="RFID-based student attendance management system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(students_router)
app.include_router(rfid_router)
app.include_router(attendance_router)


@app.get("/")
def root():

    return {
        "message": "Student RFID Attendance System API is running"
    }