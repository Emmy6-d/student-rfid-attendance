from fastapi import APIRouter, HTTPException, status

from app.schemas.student import (
    StudentCreate,
    StudentResponse,
    StudentUpdate
)

from app.services.student_service import (
    create_student,
    get_students,
    get_student,
    update_student,
    delete_student
)


router = APIRouter(
    prefix="/students",
    tags=["Students"]
)


@router.post(
    "",
    response_model=StudentResponse,
    status_code=status.HTTP_201_CREATED
)
def create_student_endpoint(student: StudentCreate):

    try:
        result = create_student(student)

        if not result:
            raise HTTPException(
                status_code=400,
                detail="Student could not be created"
            )

        return result[0]

    except Exception as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@router.get(
    "",
    response_model=list[StudentResponse]
)
def get_all_students():

    try:
        return get_students()

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


@router.get(
    "/{student_uuid}",
    response_model=StudentResponse
)
def get_student_by_id(student_uuid: str):

    student = get_student(student_uuid)

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    return student


@router.put(
    "/{student_uuid}",
    response_model=StudentResponse
)
def update_student_by_id(
    student_uuid: str,
    student: StudentUpdate
):

    updated_student = update_student(
        student_uuid,
        student
    )

    if not updated_student:
        raise HTTPException(
            status_code=404,
            detail="Student not found or no changes provided"
        )

    return updated_student


@router.delete(
    "/{student_uuid}"
)
def delete_student_by_id(student_uuid: str):

    deleted_student = delete_student(
        student_uuid
    )

    if not deleted_student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )

    return {
        "success": True,
        "message": "Student deleted successfully",
        "student": deleted_student
    }