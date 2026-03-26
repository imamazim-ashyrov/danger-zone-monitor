import { useCallback, useEffect } from "react";

/**
 * Extension point for future device-to-device streaming (WebRTC, etc.)
 * 
 * Current behavior: No-op (returns stub functions)
 * Future implementations could:
 * - Stream video frames from source device to monitor device
 * - Sync zone definitions across devices
 * - Share detection results in real-time
 * - Bi-directional configuration updates
 */

export default function useStreamingChannel({ roomId, mode, onRemoteFrame = () => {} }) {
  // TODO: Initialize WebRTC connection when enabled
  useEffect(() => {
    if (!roomId || !mode) return;

    // Future: WebRTC peer connection setup
    // Future: Establish data/media channels
    // Future: Subscribe to remote streams based on device mode

    return () => {
      // Future: Clean up WebRTC connections
    };
  }, [roomId, mode]);

  /**
   * Send frame data to remote device (source device only)
   * Future: Stream video frame to monitor device for live preview
   */
  const sendFrame = useCallback(async (frameData) => {
    // TODO: Implement WebRTC frame streaming
    // frameData: { timestamp, detections, videoState, etc. }
  }, []);

  /**
   * Send zone definitions to remote devices
   * Future: Sync zones across source and monitor devices
   */
  const syncZones = useCallback(async (zones) => {
    // TODO: Implement zone sync via WebRTC data channel
    // Notify all devices in room of zone changes
  }, []);

  /**
   * Listen for remote device capabilities/config changes
   * Future: React to monitor devices joining/leaving, config changes
   */
  const onRemoteDeviceUpdate = useCallback((deviceInfo) => {
    // TODO: Handle remote device info updates
    // deviceInfo: { deviceId, mode, capabilities, etc. }
  }, []);

  return {
    // Stream management
    sendFrame,
    syncZones,
    onRemoteDeviceUpdate,
    
    // Status (future)
    isConnected: false,
    remoteDevices: [],
  };
}
