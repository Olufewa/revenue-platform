export class EventNotPendingError extends Error {
  constructor() {
    super('Event is no longer PENDING');
    this.name = 'EventNotPendingError';
  }
}
