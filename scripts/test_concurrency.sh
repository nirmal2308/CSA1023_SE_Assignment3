#!/usr/bin/env bash

# Smart Campus Platform - Concurrency Conflict Verification Script
# Demonstrates pessimistic row locking (SELECT FOR UPDATE) under race conditions

BASE_URL="http://localhost/api/v1"
TIMESTAMP=$(date +%s)
START_TIME="2026-11-20T10:00:00Z"
END_TIME="2026-11-20T12:00:00Z"
FACILITY_ID="fac-lab-101"

echo "======================================================================"
echo " SMART CAMPUS PLATFORM: PESSIMISTIC LOCKING CONCURRENCY BENCHMARK"
echo " Target Facility: ${FACILITY_ID} (IoT Embedded Systems Lab 101)"
echo " Reservation Window: ${START_TIME} to ${END_TIME}"
echo "======================================================================"
echo ""
echo "[DISPATCH] Firing 2 simultaneous reservation requests to reverse proxy..."

TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'campus_concurrency')
RESP_A="${TMP_DIR}/req_a.txt"
RESP_B="${TMP_DIR}/req_b.txt"

# Fire Request A (Nirmal S)
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${BASE_URL}/bookings" \
  -H "Content-Type: application/json" \
  -d "{\"facilityId\":\"${FACILITY_ID}\",\"userId\":\"user-nirmal\",\"title\":\"Edge AI Benchmark Thread A\",\"startTime\":\"${START_TIME}\",\"endTime\":\"${END_TIME}\",\"notes\":\"Parallel concurrency test request A\"}" \
  > "${RESP_A}" &
PID_A=$!

# Fire Request B (Dr. Karpagam)
curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${BASE_URL}/bookings" \
  -H "Content-Type: application/json" \
  -d "{\"facilityId\":\"${FACILITY_ID}\",\"userId\":\"user-karpagam\",\"title\":\"Robotics Sim Thread B\",\"startTime\":\"${START_TIME}\",\"endTime\":\"${END_TIME}\",\"notes\":\"Parallel concurrency test request B\"}" \
  > "${RESP_B}" &
PID_B=$!

wait $PID_A
wait $PID_B

BODY_A=$(grep -v "HTTP_STATUS:" "${RESP_A}")
STATUS_A=$(grep "HTTP_STATUS:" "${RESP_A}" | cut -d':' -f2)

BODY_B=$(grep -v "HTTP_STATUS:" "${RESP_B}")
STATUS_B=$(grep "HTTP_STATUS:" "${RESP_B}" | cut -d':' -f2)

echo ""
echo "--------------------------- REQUEST A ---------------------------"
echo "HTTP Status Code : ${STATUS_A}"
echo "Response Body    : ${BODY_A}"
echo ""
echo "--------------------------- REQUEST B ---------------------------"
echo "HTTP Status Code : ${STATUS_B}"
echo "Response Body    : ${BODY_B}"
echo "-----------------------------------------------------------------"
echo ""

if { [ "$STATUS_A" = "201" ] && [ "$STATUS_B" = "409" ]; } || { [ "$STATUS_A" = "409" ] && [ "$STATUS_B" = "201" ]; }; then
  echo "[VERIFICATION SUCCESS] Row-level lock serialized concurrent transactions."
  echo "Expected Outcome: 1 Created (HTTP 201), 1 Rejected (HTTP 409 Conflict)."
  echo "OVERLAPPING_RESERVATION successfully prevented double booking."
else
  echo "[WARNING] Unexpected status codes returned: Request A=${STATUS_A}, Request B=${STATUS_B}"
fi

echo "======================================================================"

rm -rf "${TMP_DIR}"
