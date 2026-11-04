
import mongoose from "mongoose";

// Media schema
const mediaSchema = new mongoose.Schema(
  {
    filename: String,
    originalName: String,
    path: String,
    mimetype: String
  },
  { timestamps: true }
);

// Activity schema
const activitySchema = new mongoose.Schema(
  {
    dayNumber: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ["Travel", "Hotel", "Sightseeing", "Food", "Other"],
      default: "Other"
    },
    date: Date,
    time: String,
    notes: {
      type: String,
      default: ""
    },
    media: [mediaSchema]
  },
  { timestamps: true }
);

// Booking schema
const bookingSchema = new mongoose.Schema(
  {
    bookingType: {
      type: String,
      enum: ["Flight", "Train", "Bus", "Hotel", "Other"],
      required: true
    },
    title: {
      type: String,
      required: true
    },
    bookingDate: Date,
    bookingTime: {
      type: String,
      default: ""
    },
    referenceNumber: {
      type: String,
      default: ""
    },
    details: {
      type: String,
      default: ""
    },
    bookingDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

// Main Trip schema
const tripSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    tripName: {
      type: String,
      required: true
    },
    destination: {
      type: String,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    reflections: {
      type: String,
      default: ""
    },
    activities: [activitySchema],
    bookings: [bookingSchema],
    shareToken: {
      type: String,
      default: null
    },
    isShared: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Create and export Trip model
const Trip = mongoose.model("Trip", tripSchema);

export default Trip;
