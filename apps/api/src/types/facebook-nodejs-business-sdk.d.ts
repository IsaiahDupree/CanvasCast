/**
 * Type declarations for facebook-nodejs-business-sdk
 * Minimal types needed for Meta Conversions API implementation
 */

declare module 'facebook-nodejs-business-sdk' {
  export class FacebookAdsApi {
    static init(accessToken: string): void;
  }

  export class ServerEvent {
    setEventName(name: string): this;
    setEventTime(time: number): this;
    setEventId(id: string): this;
    setEventSourceUrl(url: string): this;
    setUserData(userData: UserData): this;
    setCustomData(customData: CustomData): this;
    setActionSource(source: string): this;
  }

  export class EventRequest {
    constructor(accessToken: string, pixelId: string);
    setEvents(events: ServerEvent[]): this;
    execute(): Promise<{
      events_received: number;
      messages: string[];
    }>;
  }

  export class UserData {
    setEmail(email: string): this;
    setPhone(phone: string): this;
    setClientIpAddress(ip: string): this;
    setClientUserAgent(userAgent: string): this;
    setFbp(fbp: string): this;
    setFbc(fbc: string): this;
  }

  export class CustomData {
    setValue(value: number): this;
    setCurrency(currency: string): this;
    setContentIds(ids: string[]): this;
    setContentType(type: string): this;
    setNumItems(num: number): this;
  }
}
