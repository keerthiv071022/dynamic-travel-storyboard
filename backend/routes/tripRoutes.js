
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

import Trip from "../models/Trip.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------
// FILE UPLOAD CONFIGURATION
// --------------------------------------------------

const uploadDirectory = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      crypto.randomBytes(6).toString("hex") +
      path.extname(file.originalname).toLowerCase();

    cb(null, uniqueName);
  }
});

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime"
];

const upload = multer({
  storage,

  limits: {
    fileSize: 50 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only JPG, PNG, GIF, WEBP, MP4, WEBM and MOV files are allowed."
        )
      );
    }
  }
});

// --------------------------------------------------
// HELPER: CHECK TRIP OWNERSHIP
// --------------------------------------------------

const getOwnedTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      userId: req.userId
    });

    if (!trip) {
      return res.status(404).json({
        message: "Trip not found or you do not have permission."
      });
    }

    req.trip = trip;
    next();
  } catch (error) {
    res.status(500).json({
      message: "Unable to find trip.",
      error: error.message
    });
  }
};

// --------------------------------------------------
// CREATE A NEW TRIP
// POST /api/trips
// --------------------------------------------------

router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      tripName,
      destination,
      startDate,
      endDate
    } = req.body;

    if (!tripName || !destination || !startDate || !endDate) {
      return res.status(400).json({
        message: "Please provide all trip details."
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end < start
    ) {
      return res.status(400).json({
        message: "Please provide valid travel dates."
      });
    }

    const trip = await Trip.create({
      userId: req.userId,
      tripName,
      destination,
      startDate: start,
      endDate: end
    });

    res.status(201).json({
      message: "Trip created successfully.",
      trip
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create trip.",
      error: error.message
    });
  }
});

// --------------------------------------------------
// GET ALL TRIPS BELONGING TO LOGGED-IN USER
// GET /api/trips
// --------------------------------------------------

router.get("/", authMiddleware, async (req, res) => {
  try {
    const trips = await Trip.find({
      userId: req.userId
    }).sort({ createdAt: -1 });

    res.json(trips);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch trips.",
      error: error.message
    });
  }
});

// --------------------------------------------------
// GET ONE PRIVATE TRIP
// GET /api/trips/:tripId
// --------------------------------------------------

router.get("/:tripId", authMiddleware, getOwnedTrip, (req, res) => {
  res.json(req.trip);
});

// --------------------------------------------------
// DELETE A TRIP
// DELETE /api/trips/:tripId
// --------------------------------------------------

router.delete("/:tripId", authMiddleware, getOwnedTrip, async (req, res) => {
  try {
    // Delete uploaded files belonging to this trip
    for (const activity of req.trip.activities) {
      for (const media of activity.media) {
        const filename = path.basename(media.filename || "");

        if (filename) {
          const filePath = path.join(uploadDirectory, filename);

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
    }

    await req.trip.deleteOne();

    res.json({
      message: "Trip deleted successfully."
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete trip.",
      error: error.message
    });
  }
});

// --------------------------------------------------
// SAVE TRIP REFLECTION
// PUT /api/trips/:tripId/reflections
// --------------------------------------------------

router.put(
  "/:tripId/reflections",
  authMiddleware,
  getOwnedTrip,
  async (req, res) => {
    try {
      req.trip.reflections = req.body.reflections || "";

      await req.trip.save();

      res.json({
        message: "Reflection saved successfully.",
        trip: req.trip
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to save reflection.",
        error: error.message
      });
    }
  }
);

// --------------------------------------------------
// ADD ACTIVITY
// POST /api/trips/:tripId/activities
// --------------------------------------------------


// --------------------------------------------------
// ADD ACTIVITY
// POST /api/trips/:tripId/activities
// --------------------------------------------------

router.post(
  "/:tripId/activities",
  authMiddleware,
  getOwnedTrip,
  async (req, res) => {
    try {
      const {
        title,
        category,
        date,
        time,
        notes
      } = req.body;

      // Check activity title and date
      if (!title || !title.trim() || !date) {
        return res.status(400).json({
          message: "Activity title and valid date are required."
        });
      }

      // Convert date strings into UTC date-only values
      const toDateOnly = (value) => {
        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) {
          return null;
        }

        return Date.UTC(
          parsed.getUTCFullYear(),
          parsed.getUTCMonth(),
          parsed.getUTCDate()
        );
      };

      const activityDate = toDateOnly(date);
      const tripStartDate = toDateOnly(req.trip.startDate);
      const tripEndDate = toDateOnly(req.trip.endDate);

      if (
        activityDate === null ||
        tripStartDate === null ||
        tripEndDate === null ||
        activityDate < tripStartDate ||
        activityDate > tripEndDate
      ) {
        return res.status(400).json({
          message: "Please select a valid date within your trip dates."
        });
      }

      // Automatically calculate the day number
      const dayNumber =
        Math.floor(
          (activityDate - tripStartDate) / (1000 * 60 * 60 * 24)
        ) + 1;

      const activity = {
        dayNumber,
        title: title.trim(),
        category: category || "Other",
        date: new Date(date),
        time: time || "",
        notes: notes || "",
        media: []
      };

      req.trip.activities.push(activity);

      await req.trip.save();

      res.status(201).json({
        message: "Activity added successfully.",
        trip: req.trip
      });

    } catch (error) {
      res.status(500).json({
        message: "Failed to add activity.",
        error: error.message
      });
    }
  }
);


// --------------------------------------------------
// EDIT ACTIVITY
// PUT /api/trips/:tripId/activities/:activityId
// --------------------------------------------------

router.put(
  "/:tripId/activities/:activityId",
  authMiddleware,
  getOwnedTrip,
  async (req, res) => {
    try {
      const activity = req.trip.activities.id(req.params.activityId);

      if (!activity) {
        return res.status(404).json({
          message: "Activity not found."
        });
      }

      const {
        dayNumber,
        title,
        category,
        date,
        time,
        notes
      } = req.body;

      if (dayNumber !== undefined) {
        if (Number(dayNumber) < 1) {
          return res.status(400).json({
            message: "Day number must be at least 1."
          });
        }

        activity.dayNumber = Number(dayNumber);
      }

      if (title !== undefined) activity.title = title;
      if (category !== undefined) activity.category = category;
      if (date !== undefined) activity.date = date || undefined;
      if (time !== undefined) activity.time = time;
      if (notes !== undefined) activity.notes = notes;

      await req.trip.save();

      res.json({
        message: "Activity updated successfully.",
        trip: req.trip
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to update activity.",
        error: error.message
      });
    }
  }
);

// --------------------------------------------------
// DELETE ACTIVITY
// DELETE /api/trips/:tripId/activities/:activityId
// --------------------------------------------------

router.delete(
  "/:tripId/activities/:activityId",
  authMiddleware,
  getOwnedTrip,
  async (req, res) => {
    try {
      const activity = req.trip.activities.id(req.params.activityId);

      if (!activity) {
        return res.status(404).json({
          message: "Activity not found."
        });
      }

      // Remove activity media files from uploads folder
      for (const media of activity.media) {
        const filename = path.basename(media.filename || "");

        if (filename) {
          const filePath = path.join(uploadDirectory, filename);

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }

      activity.deleteOne();

      await req.trip.save();

      res.json({
        message: "Activity deleted successfully.",
        trip: req.trip
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to delete activity.",
        error: error.message
      });
    }
  }
);

// --------------------------------------------------
// UPLOAD PHOTO OR VIDEO TO AN ACTIVITY
// POST /api/trips/:tripId/activities/:activityId/media
// FormData field name: media
// --------------------------------------------------

router.post(
  "/:tripId/activities/:activityId/media",
  authMiddleware,
  getOwnedTrip,
  (req, res, next) => {
    upload.single("media")(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          message: error.message
        });
      }

      next();
    });
  },
  async (req, res) => {
    try {
      const activity = req.trip.activities.id(req.params.activityId);

      if (!activity) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(404).json({
          message: "Activity not found."
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Please select a photo or video."
        });
      }

      const mediaItem = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: `/uploads/${req.file.filename}`,
        mimetype: req.file.mimetype
      };

      activity.media.push(mediaItem);

      await req.trip.save();

      res.status(201).json({
        message: "Media uploaded successfully.",
        media: mediaItem,
        trip: req.trip
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        message: "Media upload failed.",
        error: error.message
      });
    }
  }
);

// --------------------------------------------------
// DELETE PHOTO OR VIDEO
// DELETE /api/trips/:tripId/activities/:activityId/media/:mediaId
// --------------------------------------------------

router.delete(
  "/:tripId/activities/:activityId/media/:mediaId",
  authMiddleware,
  getOwnedTrip,
  async (req, res) => {
    try {
      const activity = req.trip.activities.id(req.params.activityId);

      if (!activity) {
        return res.status(404).json({
          message: "Activity not found."
        });
      }

      const media = activity.media.id(req.params.mediaId);

      if (!media) {
        return res.status(404).json({
          message: "Media not found."
        });
      }

      const filename = path.basename(media.filename || "");

      if (filename) {
        const filePath = path.join(uploadDirectory, filename);

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      media.deleteOne();

      await req.trip.save();

      res.json({
        message: "Media deleted successfully.",
        trip: req.trip
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to delete media.",
        error: error.message
      });
    }
  }
);

// --------------------------------------------------
// ADD BOOKING
// POST /api/trips/:tripId/bookings
// --------------------------------------------------


router.post(
  "/:tripId/bookings",
  authMiddleware,
  getOwnedTrip,
  async (req, res) => {
    try {
      const {
        bookingType,
        title,
        bookingDate,
        bookingTime,
        referenceNumber,
        details,
        bookingDetails
      } = req.body;

      if (!bookingType || !title || !title.trim()) {
        return res.status(400).json({
          message: "Booking type and title are required."
        });
      }

      const booking = {
        bookingType,
        title: title.trim(),
        bookingDate: bookingDate || undefined,
        bookingTime: bookingTime || "",
        referenceNumber: referenceNumber || "",
        details: details || "",
        bookingDetails: bookingDetails || {}
      };

      req.trip.bookings.push(booking);

      await req.trip.save();

      res.status(201).json({
        message: "Booking added successfully.",
        trip: req.trip
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to add booking.",
        error: error.message
      });
    }
  }
);


// --------------------------------------------------
// EDIT BOOKING
// PUT /api/trips/:tripId/bookings/:bookingId
// --------------------------------------------------


router.put(
  "/:tripId/bookings/:bookingId",
  authMiddleware,
  getOwnedTrip,
  async (req, res) => {
    try {
      const booking = req.trip.bookings.id(req.params.bookingId);

      if (!booking) {
        return res.status(404).json({
          message: "Booking not found."
        });
      }

      const fields = [
        "bookingType",
        "title",
        "bookingDate",
        "bookingTime",
        "referenceNumber",
        "details",
        "bookingDetails"
      ];

      fields.forEach((field) => {
        if (req.body[field] !== undefined) {
          booking[field] =
            field === "bookingDate" && !req.body[field]
              ? undefined
              : req.body[field];
        }
      });

      await req.trip.save();

      res.json({
        message: "Booking updated successfully.",
        trip: req.trip
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to update booking.",
        error: error.message
      });
    }
  }
);


// --------------------------------------------------
// DELETE BOOKING
// DELETE /api/trips/:tripId/bookings/:bookingId
// --------------------------------------------------

router.delete(
  "/:tripId/bookings/:bookingId",
  authMiddleware,
  getOwnedTrip,
  async (req, res) => {
    try {
      const booking = req.trip.bookings.id(req.params.bookingId);

      if (!booking) {
        return res.status(404).json({
          message: "Booking not found."
        });
      }

      booking.deleteOne();

      await req.trip.save();

      res.json({
        message: "Booking deleted successfully.",
        trip: req.trip
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to delete booking.",
        error: error.message
      });
    }
  }
);

// --------------------------------------------------
// GENERATE SHAREABLE LINK
// POST /api/trips/:tripId/share
// --------------------------------------------------

router.post(
  "/:tripId/share",
  authMiddleware,
  getOwnedTrip,
  async (req, res) => {
    try {
      if (!req.trip.shareToken) {
        req.trip.shareToken = crypto.randomBytes(24).toString("hex");
      }

      req.trip.isShared = true;

      await req.trip.save();

      res.json({
        message: "Travel story sharing is enabled.",
        shareToken: req.trip.shareToken,
        shareUrl: `${req.protocol}://${req.get("host")}/shared/${req.trip.shareToken}`
      });
    } catch (error) {
      res.status(500).json({
        message: "Unable to generate share link.",
        error: error.message
      });
    }
  }
);

// --------------------------------------------------
// DISABLE SHAREABLE LINK
// DELETE /api/trips/:tripId/share
// --------------------------------------------------

router.delete(
  "/:tripId/share",
  authMiddleware,
  getOwnedTrip,
  async (req, res) => {
    try {
      req.trip.isShared = false;
      req.trip.shareToken = null;

      await req.trip.save();

      res.json({
        message: "Travel story sharing has been disabled."
      });
    } catch (error) {
      res.status(500).json({
        message: "Unable to disable sharing.",
        error: error.message
      });
    }
  }
);

// --------------------------------------------------
// PUBLIC SHARED TRAVEL STORY
// GET /api/trips/share/:shareToken
// No login required
// --------------------------------------------------

router.get("/share/:shareToken", async (req, res) => {
  try {
    const trip = await Trip.findOne({
      shareToken: req.params.shareToken,
      isShared: true
    }).select(
      "tripName destination startDate endDate reflections activities bookings createdAt"
    );

    if (!trip) {
      return res.status(404).json({
        message: "This shared travel story is unavailable."
      });
    }

    res.json(trip);
  } catch (error) {
    res.status(500).json({
      message: "Unable to load shared travel story.",
      error: error.message
    });
  }
});




export default router;
