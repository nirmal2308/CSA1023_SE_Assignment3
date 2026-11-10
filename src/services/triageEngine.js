/**
 * Smart Campus Automated Sensor Triage Engine
 * Classifies telemetry spikes and provisions SLA-bound maintenance tickets
 */

function evaluateTelemetry({ sensorId, metric, reading, threshold, facilityId, facilityType, facilityName }) {
  const numReading = parseFloat(reading);
  const numThreshold = parseFloat(threshold);
  const isServerZone = facilityType === 'SERVER_ROOM' || (facilityId && facilityId.includes('server'));

  let severity = 'LOW';
  let slaHours = 8;
  let category = 'GENERAL';
  let rationale = '';
  let requiresMaintenanceLock = false;

  // Temperature Spike Evaluation
  if (metric === 'TEMPERATURE_CELSIUS') {
    category = 'HVAC';
    if (numReading > 30.0 || (isServerZone && numReading > numThreshold)) {
      severity = 'CRITICAL';
      slaHours = 1;
      requiresMaintenanceLock = true;
      rationale = `Automated Triage: TEMPERATURE_CELSIUS reading (${numReading.toFixed(1)}°C) exceeded critical threshold (${numThreshold.toFixed(1)}°C) in high-risk zone (${facilityName || 'Server Room A'}). High risk of thermal throttling and permanent server component degradation. Automated 1-hour critical emergency SLA dispatch triggered.`;
    } else if (numReading > numThreshold) {
      severity = 'HIGH';
      slaHours = 4;
      rationale = `Automated Triage: Temperature reading (${numReading.toFixed(1)}°C) exceeded normal comfort threshold (${numThreshold.toFixed(1)}°C). Dispatched HVAC inspection team with 4-hour SLA.`;
    } else {
      severity = 'LOW';
      slaHours = 12;
      rationale = `Automated Triage: Ambient temperature nominal (${numReading.toFixed(1)}°C). Routine operational logging.`;
    }
  } else if (metric === 'VIBRATION_MM_S' || metric === 'VIBRATION') {
    category = 'HVAC';
    if (numReading > 5.0 || isServerZone) {
      severity = 'CRITICAL';
      slaHours = 1;
      requiresMaintenanceLock = true;
      rationale = `Automated Triage: Extreme harmonic vibration (${numReading.toFixed(1)} mm/s) detected at critical HVAC air handler. Risk of catastrophic chiller compressor failure. 1-hour emergency ticket generated.`;
    } else if (numReading > numThreshold) {
      severity = 'HIGH';
      slaHours = 4;
      rationale = `Automated Triage: Elevated motor vibration (${numReading.toFixed(1)} mm/s) exceeds operational tolerance (${numThreshold.toFixed(1)} mm/s). Mechanical bearing inspection scheduled.`;
    }
  } else {
    if (numReading > numThreshold) {
      severity = 'MEDIUM';
      slaHours = 6;
      category = 'ELECTRICAL';
      rationale = `Automated Triage: Sensor ${sensorId} telemetry threshold anomaly (${numReading} > ${numThreshold}). Standard inspection assigned.`;
    }
  }

  const slaDeadline = new Date(Date.now() + slaHours * 3600 * 1000);

  return {
    severity,
    slaHours,
    slaDeadline,
    category,
    rationale,
    requiresMaintenanceLock,
    title: `${severity} ${category} Alert: ${sensorId} at ${facilityName || facilityId}`,
    description: `Automated incident triggered by sensor ${sensorId}. Telemetry value: ${numReading} (Threshold: ${numThreshold}).`,
  };
}

module.exports = {
  evaluateTelemetry,
};
