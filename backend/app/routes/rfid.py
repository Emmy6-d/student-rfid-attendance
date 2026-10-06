from fastapi import APIRouter, HTTPException, status

from app.schemas.rfid import (
    RFIDEnrollmentCreate,
    RFIDEnrollmentScan,
    RFIDAssign,
    RFIDUpdate
)

from app.services.rfid_service import (
    get_all_rfid_cards,
    get_rfid_card,
    assign_rfid,
    update_rfid,
    delete_rfid,
    create_enrollment_request,
    get_enrollment_request,
    get_pending_enrollment_request,
    cancel_enrollment_request,
    complete_enrollment_request,
)


router = APIRouter(
    prefix="/rfid",
    tags=["RFID Cards"]
)


@router.post("/enrollment-requests", status_code=status.HTTP_201_CREATED)
def start_card_enrollment(data: RFIDEnrollmentCreate):
    try:
        result = create_enrollment_request(data)
        if not result["success"]:
            raise HTTPException(status_code=409, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/enrollment-requests/pending")
def get_next_card_enrollment():
    try:
        return get_pending_enrollment_request()
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/enrollment-requests/{request_id}")
def get_card_enrollment_status(request_id: str):
    try:
        request = get_enrollment_request(request_id)
        if not request:
            raise HTTPException(status_code=404, detail="Enrollment request not found")
        return request
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/enrollment-requests/{request_id}/scan")
def submit_enrollment_scan(request_id: str, data: RFIDEnrollmentScan):
    try:
        result = complete_enrollment_request(request_id, data)
        if not result["success"]:
            error_status = 404 if result["status"] == "request_not_found" else 409
            raise HTTPException(status_code=error_status, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/enrollment-requests/{request_id}/cancel")
def cancel_card_enrollment(request_id: str):
    try:
        result = cancel_enrollment_request(request_id)
        if not result:
            raise HTTPException(status_code=409, detail="Enrollment request is no longer pending")
        return result
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@router.get("")
def get_rfid_cards():

    try:
        return get_all_rfid_cards()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


@router.get("/{rfid_id}")
def get_rfid(rfid_id: str):

    card = get_rfid_card(rfid_id)

    if not card:
        raise HTTPException(
            status_code=404,
            detail="RFID card not found"
        )

    return card


@router.post("/assign")
def assign_rfid_card(data: RFIDAssign):

    try:

        result = assign_rfid(data)

        if not result["success"]:

            raise HTTPException(
                status_code=400,
                detail=result
            )

        return result

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


@router.put("/{rfid_id}")
def update_rfid_card(
    rfid_id: str,
    data: RFIDUpdate
):

    try:

        result = update_rfid(
            rfid_id,
            data
        )

        if not result:

            raise HTTPException(
                status_code=404,
                detail="RFID card not found or no changes provided"
            )

        return {
            "success": True,
            "message": "RFID card updated successfully",
            "rfid": result
        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


@router.delete("/{rfid_id}")
def delete_rfid_card(rfid_id: str):

    try:

        result = delete_rfid(rfid_id)

        if not result:

            raise HTTPException(
                status_code=404,
                detail="RFID card not found"
            )

        return {
            "success": True,
            "message": "RFID card deleted successfully",
            "rfid": result
        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )