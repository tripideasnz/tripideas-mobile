export class CreateTripWithPlaceError extends Error {
  constructor(
    readonly stage: 'attach' | 'create',
    readonly tripId: string | null,
    readonly cause?: unknown
  ) {
    super(
      stage === 'attach'
        ? 'The Trip was created, but the place could not be added.'
        : 'The Trip could not be created.'
    );
    this.name = 'CreateTripWithPlaceError';
  }
}
