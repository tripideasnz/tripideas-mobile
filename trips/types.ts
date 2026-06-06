export type MyTripPlace = {
  addedAt: string;
  note: string;
  placeId: string;
};

export type MyTrip = {
  createdAt: string;
  id: string;
  name: string;
  note: string;
  places: MyTripPlace[];
  updatedAt: string;
};
