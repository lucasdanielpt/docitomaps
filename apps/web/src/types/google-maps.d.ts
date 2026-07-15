/** Tipos mínimos para Google Maps JavaScript API (Street View). */
declare namespace google.maps {
  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
  }

  enum StreetViewSource {
    DEFAULT = 'default',
    OUTDOOR = 'outdoor',
  }

  enum StreetViewStatus {
    OK = 'OK',
  }

  interface StreetViewLocationRequest {
    location: LatLng | { lat: number; lng: number };
    radius?: number;
    source?: StreetViewSource;
  }

  interface StreetViewPov {
    heading: number;
    pitch: number;
  }

  interface StreetViewPanoramaOptions {
    disableDefaultUI?: boolean;
    scrollwheel?: boolean;
    motionTracking?: boolean;
    motionTrackingControl?: boolean;
  }

  class StreetViewPanorama {
    constructor(container: HTMLElement, opts?: StreetViewPanoramaOptions);
    setPano(pano: string): void;
    setPosition(latLng: LatLng | { lat: number; lng: number }): void;
    setPov(pov: StreetViewPov): void;
    setVisible(visible: boolean): void;
  }

  class StreetViewService {
    getPanorama(
      request: StreetViewLocationRequest,
    ): Promise<{ data: StreetViewPanoramaData }>;
  }

  interface StreetViewPanoramaData {
    location: {
      latLng: LatLng;
      pano: string;
      description?: string;
    };
  }
}

interface Window {
  google?: typeof google;
}
