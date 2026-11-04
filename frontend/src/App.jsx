
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
const API =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:5000");

const markerIcon = L.icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("travelToken") || ""
  );

  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("travelUser") || "null")
  );

  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [pageError, setPageError] = useState("");

  const [tripForm, setTripForm] = useState({
    tripName: "",
    destination: "",
    startDate: "",
    endDate: ""
  });

  const [activityForm, setActivityForm] = useState({
    title: "",
    category: "Sightseeing",
    date: "",
    time: "",
    notes: ""
  });

const [bookingForm, setBookingForm] = useState({
  bookingType: "Flight",
  title: "",
  bookingDate: "",
  bookingTime: "",
  referenceNumber: "",
  details: "",
  bookingDetails: {}
});

  const [reflection, setReflection] = useState("");
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  const [mapLocation, setMapLocation] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState("");

  const [sharedTrip, setSharedTrip] = useState(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState("");

  const [editingActivity, setEditingActivity] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);

  const shareToken = window.location.pathname.startsWith("/shared/")
    ? window.location.pathname.split("/")[2]
    : null;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };

  // ---------------- MEDIA URL HELPER ----------------

  function getMediaUrl(mediaPath) {
    if (!mediaPath) return "";

    if (mediaPath.startsWith("http")) {
      return mediaPath;
    }

    return `${SERVER_URL}/${mediaPath.replace(/^\/+/, "")}`;
  }

  // ---------------- AUTHENTICATION ----------------

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      const endpoint =
        authMode === "register"
          ? `${API}/auth/register`
          : `${API}/auth/login`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Authentication failed"
        );
      }

      const receivedToken = data.token;
      const receivedUser = data.user;

      if (!receivedToken || !receivedUser) {
        throw new Error(
          "The server did not return a token and user profile."
        );
      }

      localStorage.setItem("travelToken", receivedToken);
      localStorage.setItem("travelUser", JSON.stringify(receivedUser));

      setToken(receivedToken);
      setUser(receivedUser);
      setAuthForm({ name: "", email: "", password: "" });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("travelToken");
    localStorage.removeItem("travelUser");

    setToken("");
    setUser(null);
    setTrips([]);
    setSelectedTrip(null);

    window.history.replaceState({}, "", "/");
  }

  // ---------------- API HELPERS ----------------

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      logout();
      throw new Error(
        "Your session has expired. Please log in again."
      );
    }

    if (!response.ok) {
      throw new Error(
        data.message || data.error || "Something went wrong"
      );
    }

    return data;
  }

  function extractTrip(data) {
    return data.trip || data;
  }

  // ---------------- FETCH TRIPS ----------------

  async function fetchTrips() {
    if (!token) return;

    try {
      setPageError("");

      const data = await apiRequest(`${API}/trips`);

      const tripList = Array.isArray(data)
        ? data
        : data.trips || [];

      setTrips(tripList);

      if (selectedTrip) {
        const updated = tripList.find(
          (trip) => trip._id === selectedTrip._id
        );

        if (updated) {
          setSelectedTrip(updated);
          setReflection(updated.reflections || "");
        } else {
          setSelectedTrip(null);
        }
      }
    } catch (error) {
      setPageError(error.message);
    }
  }

  useEffect(() => {
    if (token && !shareToken) {
      fetchTrips();
    }
  }, [token]);

  // ---------------- SHARED TRIP ----------------

  useEffect(() => {
    if (!shareToken) return;

    async function loadSharedTrip() {
      setSharedLoading(true);
      setSharedError("");

      try {
        const response = await fetch(
          `${API}/trips/share/${shareToken}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Shared trip not found"
          );
        }

        setSharedTrip(data.trip || data);
      } catch (error) {
        setSharedError(error.message);
      } finally {
        setSharedLoading(false);
      }
    }

    loadSharedTrip();
  }, [shareToken]);

  // ---------------- CREATE TRIP ----------------

  async function handleCreateTrip(e) {
    e.preventDefault();

    try {
      if (tripForm.endDate < tripForm.startDate) {
        alert("End date cannot be before start date.");
        return;
      }

      await apiRequest(`${API}/trips`, {
        method: "POST",
        body: JSON.stringify(tripForm)
      });

      setTripForm({
        tripName: "",
        destination: "",
        startDate: "",
        endDate: ""
      });

      await fetchTrips();
      alert("Trip created successfully!");
    } catch (error) {
      alert(error.message);
    }
  }

  // ---------------- SELECT TRIP ----------------

  function openTrip(trip) {
    setSelectedTrip(trip);
    setReflection(trip.reflections || "");
    setWeather(null);
    setMapLocation(null);
    setWeatherError("");
    setMapError("");
    setEditingActivity(null);
    setEditingBooking(null);
  }

  function backToTrips() {
    setSelectedTrip(null);
    setWeather(null);
    setMapLocation(null);
  }

  // ---------------- DELETE TRIP ----------------

  async function deleteTrip(tripId) {
    if (!window.confirm("Are you sure you want to delete this trip?")) {
      return;
    }

    try {
      await apiRequest(`${API}/trips/${tripId}`, {
        method: "DELETE"
      });

      setSelectedTrip(null);
      await fetchTrips();
    } catch (error) {
      alert(error.message);
    }
  }

  // ---------------- ACTIVITIES ----------------

  async function handleActivitySubmit(e) {
    e.preventDefault();

    if (!selectedTrip) return;

    try {
      if (editingActivity) {
        await apiRequest(
          `${API}/trips/${selectedTrip._id}/activities/${editingActivity._id}`,
          {
            method: "PUT",
            body: JSON.stringify(activityForm)
          }
        );
      } else {
        await apiRequest(
          `${API}/trips/${selectedTrip._id}/activities`,
          {
            method: "POST",
            body: JSON.stringify(activityForm)
          }
        );
      }

      setActivityForm({
        title: "",
        category: "Sightseeing",
        date: "",
        time: "",
        notes: ""
      });

      setEditingActivity(null);
      await fetchTrips();
    } catch (error) {
      alert(error.message);
    }
  }

  function startEditActivity(activity) {
    setEditingActivity(activity);

    setActivityForm({
      title: activity.title || "",
      category: activity.category || "Sightseeing",
      date: activity.date
        ? new Date(activity.date).toISOString().slice(0, 10)
        : "",
      time: activity.time || "",
      notes: activity.notes || ""
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteActivity(activityId) {
    if (!window.confirm("Delete this activity?")) return;

    try {
      await apiRequest(
        `${API}/trips/${selectedTrip._id}/activities/${activityId}`,
        { method: "DELETE" }
      );

      await fetchTrips();
    } catch (error) {
      alert(error.message);
    }
  }

  // ---------------- BOOKINGS ----------------
function updateBookingDetail(field, value) {
  setBookingForm((previous) => ({
    ...previous,
    bookingDetails: {
      ...previous.bookingDetails,
      [field]: value
    }
  }));
}
 async function handleBookingSubmit(e) {
  e.preventDefault();

  try {
    if (editingBooking) {
      await apiRequest(
        `${API}/trips/${selectedTrip._id}/bookings/${editingBooking._id}`,
        {
          method: "PUT",
          body: JSON.stringify(bookingForm)
        }
      );
    } else {
      await apiRequest(
        `${API}/trips/${selectedTrip._id}/bookings`,
        {
          method: "POST",
          body: JSON.stringify(bookingForm)
        }
      );
    }

    setBookingForm({
      bookingType: "Flight",
      title: "",
      bookingDate: "",
      bookingTime: "",
      referenceNumber: "",
      details: "",
      bookingDetails: {}
    });

    setEditingBooking(null);
    await fetchTrips();

  } catch (error) {
    alert(error.message);
  }
}

  function startEditBooking(booking) {
  setEditingBooking(booking);

  setBookingForm({
    bookingType: booking.bookingType || "Flight",
    title: booking.title || "",
    bookingDate: booking.bookingDate
      ? new Date(booking.bookingDate).toISOString().slice(0, 10)
      : "",
    bookingTime: booking.bookingTime || "",
    referenceNumber: booking.referenceNumber || "",
    details: booking.details || "",
    bookingDetails: booking.bookingDetails || {}
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}
  async function deleteBooking(bookingId) {
    if (!window.confirm("Delete this booking?")) return;

    try {
      await apiRequest(
        `${API}/trips/${selectedTrip._id}/bookings/${bookingId}`,
        { method: "DELETE" }
      );

      await fetchTrips();
    } catch (error) {
      alert(error.message);
    }
  }

  // ---------------- REFLECTIONS ----------------

  async function saveReflection() {
    try {
      await apiRequest(
        `${API}/trips/${selectedTrip._id}/reflections`,
        {
          method: "PUT",
          body: JSON.stringify({ reflections: reflection })
        }
      );

      await fetchTrips();
      alert("Your reflection has been saved!");
    } catch (error) {
      alert(error.message);
    }
  }

  // ---------------- MEDIA UPLOAD ----------------

  async function handleMediaUpload(activityId, file) {
  if (!file) return;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime"
  ];

  if (!allowedTypes.includes(file.type)) {
    alert("Please select a supported image or video file.");
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    alert("File size must be less than 50 MB.");
    return;
  }

  try {
    const resourceType = file.type.startsWith("video/")
      ? "video"
      : "image";

    // 1. Get secure upload signature from backend
    const signatureData = await apiRequest(
      `${API}/trips/${selectedTrip._id}/activities/${activityId}/media/sign`,
      {
        method: "POST",
        body: JSON.stringify({ resourceType })
      }
    );

    // 2. Upload file directly to Cloudinary
    const formData = new FormData();

    formData.append("file", file);
    formData.append("api_key", signatureData.apiKey);
    formData.append("timestamp", signatureData.timestamp);
    formData.append("signature", signatureData.signature);
    formData.append("folder", signatureData.folder);
    formData.append("public_id", signatureData.publicId);

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/${resourceType}/upload`,
      {
        method: "POST",
        body: formData
      }
    );

    const cloudinaryData = await cloudinaryResponse.json();

    if (!cloudinaryResponse.ok) {
      throw new Error(
        cloudinaryData.error?.message || "Cloudinary upload failed."
      );
    }

    // 3. Save media details in MongoDB
    await apiRequest(
      `${API}/trips/${selectedTrip._id}/activities/${activityId}/media`,
      {
        method: "POST",
        body: JSON.stringify({
          publicId: cloudinaryData.public_id,
          secureUrl: cloudinaryData.secure_url,
          originalName: file.name,
          mimetype: file.type,
          resourceType: cloudinaryData.resource_type
        })
      }
    );

    await fetchTrips();
    alert("Media uploaded successfully!");

  } catch (error) {
    alert(error.message);
  }
}

  async function deleteMedia(activityId, mediaId) {
    if (!window.confirm("Delete this media file?")) return;

    try {
      await apiRequest(
        `${API}/trips/${selectedTrip._id}/activities/${activityId}/media/${mediaId}`,
        { method: "DELETE" }
      );

      await fetchTrips();
    } catch (error) {
      alert(error.message);
    }
  }

  // ---------------- WEATHER ----------------

  async function handleWeather() {
    if (!selectedTrip) return;

    setWeatherLoading(true);
    setWeatherError("");
    setWeather(null);

    try {
      const geoResponse = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          selectedTrip.destination
        )}&count=1&language=en&format=json`
      );

      const geoData = await geoResponse.json();

      if (!geoData.results || geoData.results.length === 0) {
        throw new Error("Destination could not be found.");
      }

      const place = geoData.results[0];

      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`
      );

      const weatherData = await weatherResponse.json();

      setWeather({
        ...weatherData,
        placeName: `${place.name}${place.country ? ", " + place.country : ""}`
      });
    } catch (error) {
      setWeatherError(error.message);
    } finally {
      setWeatherLoading(false);
    }
  }

  function weatherDescription(code) {
    if (code === 0) return "Clear sky";
    if ([1, 2, 3].includes(code)) return "Partly cloudy";
    if ([45, 48].includes(code)) return "Foggy";
    if ([51, 53, 55, 61, 63, 65].includes(code)) return "Rain";
    if ([71, 73, 75, 77].includes(code)) return "Snow";
    if ([80, 81, 82].includes(code)) return "Rain showers";
    if ([95, 96, 99].includes(code)) return "Thunderstorm";
    return "Weather information";
  }

  function getWeatherSuggestion(code) {
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) {
      return "Rain is expected. Consider indoor activities, museums, cafes or shopping.";
    }

    if ([71, 73, 75, 77].includes(code)) {
      return "Cold or snowy conditions are expected. Wear warm clothing and plan accordingly.";
    }

    if ([0, 1].includes(code)) {
      return "Good weather for sightseeing, outdoor activities and photography.";
    }

    return "Check local conditions before planning outdoor activities.";
  }

  // ---------------- MAP ----------------

  async function handleShowMap() {
    setMapLoading(true);
    setMapError("");
    setMapLocation(null);

    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          selectedTrip.destination
        )}&count=1&language=en&format=json`
      );

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        throw new Error("Destination could not be found on the map.");
      }

      const place = data.results[0];

      setMapLocation({
        latitude: place.latitude,
        longitude: place.longitude,
        name: place.name
      });
    } catch (error) {
      setMapError(error.message);
    } finally {
      setMapLoading(false);
    }
  }

  // ---------------- SHARE TRIP ----------------

  async function handleGenerateShareLink() {
    try {
      const data = await apiRequest(
        `${API}/trips/${selectedTrip._id}/share`,
        { method: "POST" }
      );

      const tripData = extractTrip(data);

      const shareTokenValue =
        tripData.shareToken || data.shareToken || data.token;

      if (!shareTokenValue) {
        throw new Error("The server did not return a share token.");
      }

      const shareUrl =
        `${window.location.origin}/shared/${shareTokenValue}`;

      await navigator.clipboard.writeText(shareUrl);

      alert(`Share link copied!\n${shareUrl}`);
      await fetchTrips();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleDisableSharing() {
    if (!window.confirm("Disable public sharing for this trip?")) return;

    try {
      await apiRequest(
        `${API}/trips/${selectedTrip._id}/share`,
        { method: "DELETE" }
      );

      await fetchTrips();
      alert("Trip sharing has been disabled.");
    } catch (error) {
      alert(error.message);
    }
  }

  // ---------------- HELPERS ----------------

  function formatDate(date) {
    if (!date) return "Not specified";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function getTripDays() {
    if (!selectedTrip) return [];

    const start = new Date(selectedTrip.startDate);
    const end = new Date(selectedTrip.endDate);

    const days = [];
    const current = new Date(start);

    while (current <= end && days.length < 60) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  function getActivitiesForDate(date) {
    if (!selectedTrip) return [];

    const selectedDate = date.toISOString().slice(0, 10);

    return (selectedTrip.activities || []).filter((activity) => {
      if (!activity.date) return false;

      return (
        new Date(activity.date).toISOString().slice(0, 10) ===
        selectedDate
      );
    });
  }

  // ---------------- PUBLIC SHARED STORY ----------------

  if (shareToken) {
    if (sharedLoading) {
      return (
        <div className="loading-screen">
          Loading shared travel story...
        </div>
      );
    }

    if (sharedError || !sharedTrip) {
      return (
        <div className="loading-screen">
          <h2>Travel story unavailable</h2>
          <p>{sharedError || "This shared trip could not be found."}</p>
          <a href="/">Go to Travel Storyboard</a>
        </div>
      );
    }

    return (
      <div className="app-container">
        <header className="hero-header">
          <h1>My Travel Story</h1>
          <p>Plan your journeys. Capture your memories.</p>
        </header>

        <main className="main-content">
          <section className="trip-detail-card">
            <h2>{sharedTrip.tripName}</h2>
            <h3>📍 {sharedTrip.destination}</h3>

            <p>
              {formatDate(sharedTrip.startDate)} –{" "}
              {formatDate(sharedTrip.endDate)}
            </p>

            <h3>Travel Timeline</h3>

            {(sharedTrip.activities || []).map((activity) => (
              <div className="activity-card" key={activity._id}>
                <h4>{activity.title}</h4>
                <p>{activity.category}</p>
                <p>
                  {formatDate(activity.date)} {activity.time}
                </p>
                <p>{activity.notes}</p>

                <div className="media-grid">
                  {(activity.media || []).map((media) => (
                    <div className="media-item" key={media._id}>
                      {media.mimetype?.startsWith("video/") ? (
                        <video
                          controls
                          src={getMediaUrl(media.path)}
                        />
                      ) : (
                        <img
                          src={getMediaUrl(media.path)}
                          alt={media.originalName || "Travel memory"}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <h3>Bookings</h3>

            {(sharedTrip.bookings || []).map((booking) => (
              <div className="booking-card" key={booking._id}>
  <strong>{booking.title}</strong>

  <p>{booking.bookingType}</p>
  <p>{formatDate(booking.bookingDate)}</p>
  <p>{booking.bookingTime}</p>
  <p>Reference: {booking.referenceNumber || "N/A"}</p>
  <p>{booking.details}</p>

  {Object.entries(booking.bookingDetails || {}).map(([key, value]) =>
    value ? (
      <p key={key}>
        <strong>
          {key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}:
        </strong>{" "}
        {value}
      </p>
    ) : null
  )}
</div>
            ))}

            <h3>Travel Reflections</h3>
            <p>{sharedTrip.reflections || "No reflections added yet."}</p>
          </section>
        </main>
      </div>
    );
  }

  // ---------------- LOGIN / REGISTER PAGE ----------------

  if (!token || !user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">✈️</div>

          <h1>Travel Storyboard</h1>
          <p>Plan your journeys. Capture your memories.</p>

          <div className="auth-tabs">
            <button
              className={authMode === "login" ? "active" : ""}
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
              }}
            >
              Login
            </button>

            <button
              className={authMode === "register" ? "active" : ""}
              onClick={() => {
                setAuthMode("register");
                setAuthError("");
              }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuthSubmit}>
            {authMode === "register" && (
              <input
                type="text"
                placeholder="Your name"
                value={authForm.name}
                onChange={(e) =>
                  setAuthForm({ ...authForm, name: e.target.value })
                }
                required
              />
            )}

            <input
              type="email"
              placeholder="Email address"
              value={authForm.email}
              onChange={(e) =>
                setAuthForm({ ...authForm, email: e.target.value })
              }
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(e) =>
                setAuthForm({ ...authForm, password: e.target.value })
              }
              required
              minLength={6}
            />

            {authError && (
              <p className="error-message">{authError}</p>
            )}

            <button className="primary-button" disabled={loading}>
              {loading
                ? "Please wait..."
                : authMode === "register"
                ? "Create Account"
                : "Login"}
            </button>
          </form>

          <p className="auth-footer">
            Your journeys deserve a beautiful story.
          </p>
        </div>
      </div>
    );
  }

  // ---------------- MAIN APPLICATION ----------------

  return (
    <div className="app-container">
      <header className="hero-header">
        <div>
          <h1>✈️ Dynamic Travel Storyboard</h1>
          <p>Plan your journeys. Capture your memories.</p>
        </div>

        <div className="user-section">
          <span>Welcome, {user.name}</span>
          <button className="logout-button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="main-content">
        {pageError && (
          <p className="error-message">{pageError}</p>
        )}

        {!selectedTrip ? (
          <>
            <section className="form-card">
              <h2>Create a New Trip</h2>

              <form onSubmit={handleCreateTrip} className="trip-form">
                <label>Trip Name</label>
                <input
                  type="text"
                  placeholder="Example: Kerala Vacation"
                  value={tripForm.tripName}
                  onChange={(e) =>
                    setTripForm({
                      ...tripForm,
                      tripName: e.target.value
                    })
                  }
                  required
                />

                <label>Destination</label>
                <input
                  type="text"
                  placeholder="Example: Munnar"
                  value={tripForm.destination}
                  onChange={(e) =>
                    setTripForm({
                      ...tripForm,
                      destination: e.target.value
                    })
                  }
                  required
                />

                <div className="date-grid">
                  <div>
                    <label>Start Date</label>
                    <input
                      type="date"
                      value={tripForm.startDate}
                      onChange={(e) =>
                        setTripForm({
                          ...tripForm,
                          startDate: e.target.value
                        })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label>End Date</label>
                    <input
                      type="date"
                      min={tripForm.startDate || undefined}
                      value={tripForm.endDate}
                      onChange={(e) =>
                        setTripForm({
                          ...tripForm,
                          endDate: e.target.value
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <button className="primary-button">
                  Create Trip
                </button>
              </form>
            </section>

            <section className="trips-section">
              <div className="section-heading">
                <h2>My Trips</h2>
                <button
                  className="secondary-button"
                  onClick={fetchTrips}
                >
                  Refresh
                </button>
              </div>

              {trips.length === 0 ? (
                <div className="empty-state">
                  <span>🌍</span>
                  <h3>No trips found</h3>
                  <p>Create your first trip and start planning!</p>
                </div>
              ) : (
                <div className="trip-grid">
                  {trips.map((trip) => (
                    <div className="trip-card" key={trip._id}>
                      <div className="trip-card-icon">🌴</div>

                      <h3>{trip.tripName}</h3>
                      <p>📍 {trip.destination}</p>

                      <p>
                        {formatDate(trip.startDate)} –{" "}
                        {formatDate(trip.endDate)}
                      </p>

                      <p>
                        {(trip.activities || []).length} activities ·{" "}
                        {(trip.bookings || []).length} bookings
                      </p>

                      <button
                        className="primary-button"
                        onClick={() => openTrip(trip)}
                      >
                        Open Trip
                      </button>

                      <button
                        className="delete-button"
                        onClick={() => deleteTrip(trip._id)}
                      >
                        Delete Trip
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <button className="back-button" onClick={backToTrips}>
              ← Back to My Trips
            </button>

            <section className="trip-detail-card">
              <div className="trip-title-row">
                <div>
                  <h2>{selectedTrip.tripName}</h2>
                  <h3>📍 {selectedTrip.destination}</h3>
                  <p>
                    {formatDate(selectedTrip.startDate)} –{" "}
                    {formatDate(selectedTrip.endDate)}
                  </p>
                </div>

                <span className="trip-badge">My Journey</span>
              </div>
            </section>

            {/* TIMELINE */}

            <section className="content-card">
              <h2>📅 Travel Storyboard Timeline</h2>

              {getTripDays().map((date, index) => {
                const activities = getActivitiesForDate(date);

                return (
                  <div
                    className="timeline-day"
                    key={date.toISOString()}
                  >
                    <div className="timeline-day-heading">
                      <span>Day {index + 1}</span>
                      <h3>{formatDate(date)}</h3>
                    </div>

                    {activities.length === 0 ? (
                      <p className="muted-text">
                        No activities planned for this day.
                      </p>
                    ) : (
                      activities.map((activity) => (
                        <div
                          className="activity-card"
                          key={activity._id}
                        >
                          <div className="activity-heading">
                            <div>
                              <span className="category-label">
                                {activity.category}
                              </span>
                              <h3>{activity.title}</h3>
                              <p>
                                {activity.time || "Time not specified"}
                              </p>
                            </div>

                            <div className="action-buttons">
                              <button
                                onClick={() =>
                                  startEditActivity(activity)
                                }
                              >
                                Edit
                              </button>

                              <button
                                className="delete-text-button"
                                onClick={() =>
                                  deleteActivity(activity._id)
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <p>{activity.notes}</p>

                          {/* MEDIA GALLERY */}

                          <div className="media-grid">
                            {(activity.media || []).map((media) => (
                              <div
                                className="media-item"
                                key={media._id}
                              >
                                {media.mimetype?.startsWith("video/") ? (
                                  <video
                                    controls
                                    src={getMediaUrl(media.path)}
                                  >
                                    Your browser does not support video.
                                  </video>
                                ) : (
                                  <img
                                    src={getMediaUrl(media.path)}
                                    alt={
                                      media.originalName ||
                                      "Travel memory"
                                    }
                                    onError={(e) => {
                                      console.error(
                                        "Image failed to load:",
                                        e.currentTarget.src
                                      );
                                    }}
                                  />
                                )}

                                <button
                                  className="delete-media-button"
                                  onClick={() =>
                                    deleteMedia(
                                      activity._id,
                                      media._id
                                    )
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>

                          <label className="upload-button">
                            📷 Add Photo / Video

                            <input
                              type="file"
                              accept="image/*,video/mp4,video/webm,video/quicktime"
                              onChange={(e) => {
                                handleMediaUpload(
                                  activity._id,
                                  e.target.files[0]
                                );

                                e.target.value = "";
                              }}
                              hidden
                            />
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </section>

            {/* ADD ACTIVITY */}

            <section className="content-card">
              <h2>
                {editingActivity ? "Edit Activity" : "Add an Activity"}
              </h2>

              <form
                onSubmit={handleActivitySubmit}
                className="trip-form"
              >
                <label>Activity Name</label>
                <input
                  type="text"
                  placeholder="Example: Visit Tea Museum"
                  value={activityForm.title}
                  onChange={(e) =>
                    setActivityForm({
                      ...activityForm,
                      title: e.target.value
                    })
                  }
                  required
                />

                <label>Category</label>
                <select
                  value={activityForm.category}
                  onChange={(e) =>
                    setActivityForm({
                      ...activityForm,
                      category: e.target.value
                    })
                  }
                >
                  <option>Travel</option>
                  <option>Hotel</option>
                  <option>Sightseeing</option>
                  <option>Food</option>
                  <option>Other</option>
                </select>

                <div className="date-grid">
                  <div>
                    <label>Date</label>
                    <input
                      type="date"
                      min={selectedTrip.startDate?.slice(0, 10)}
                      max={selectedTrip.endDate?.slice(0, 10)}
                      value={activityForm.date}
                      onChange={(e) =>
                        setActivityForm({
                          ...activityForm,
                          date: e.target.value
                        })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label>Time</label>
                    <input
                      type="time"
                      value={activityForm.time}
                      onChange={(e) =>
                        setActivityForm({
                          ...activityForm,
                          time: e.target.value
                        })
                      }
                    />
                  </div>
                </div>

                <label>Notes</label>
                <textarea
                  placeholder="Add details about this activity..."
                  value={activityForm.notes}
                  onChange={(e) =>
                    setActivityForm({
                      ...activityForm,
                      notes: e.target.value
                    })
                  }
                />

                <button className="primary-button">
                  {editingActivity
                    ? "Update Activity"
                    : "Add Activity"}
                </button>

                {editingActivity && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setEditingActivity(null);
                      setActivityForm({
                        title: "",
                        category: "Sightseeing",
                        date: "",
                        time: "",
                        notes: ""
                      });
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </form>
            </section>

            {/* BOOKINGS */}

            <section className="content-card">
              <h2>🎫 Travel Bookings</h2>

              <form
                onSubmit={handleBookingSubmit}
                className="trip-form"
              >
               
<label>Booking Type</label>

<select
  value={bookingForm.bookingType}
  onChange={(e) =>
    setBookingForm({
      ...bookingForm,
      bookingType: e.target.value,
      bookingDetails: {}
    })
  }
>
  <option value="Flight">Flight</option>
  <option value="Train">Train</option>
  <option value="Bus">Bus</option>
  <option value="Hotel">Hotel</option>
  <option value="Other">Other</option>
</select>

{/* FLIGHT DETAILS */}
{bookingForm.bookingType === "Flight" && (
  <>
    <h3>✈️ Flight Details</h3>
    {/* Keep your existing flight input fields here */}
  </>
)}

{/* TRAIN DETAILS */}
{bookingForm.bookingType === "Train" && (
  <>
    <h3>🚆 Train Details</h3>
    {/* Keep your existing train input fields here */}
  </>
)}

{/* BUS DETAILS */}
{bookingForm.bookingType === "Bus" && (
  <>
    <h3>🚌 Bus Details</h3>
    {/* Keep your existing bus input fields here */}
  </>
)}

{/* HOTEL DETAILS */}
{bookingForm.bookingType === "Hotel" && (
  <>
    <h3>🏨 Hotel Details</h3>
    {/* Keep your existing hotel input fields here */}
  </>
)}

{/* OTHER BOOKING */}
{bookingForm.bookingType === "Other" && (
  <>
    <h3>📌 Other Booking Details</h3>
    {/* Keep your existing other booking input fields here */}
  </>
)}

                <label>Booking Title</label>
                <input
                  type="text"
                  placeholder="Example: Kochi to Delhi Flight"
                  value={bookingForm.title}
                  onChange={(e) =>
                    setBookingForm({
                      ...bookingForm,
                      title: e.target.value
                    })
                  }
                  required
                />

                <div className="date-grid">
                  <div>
                    <label>Booking Date</label>
                    <input
                      type="date"
                      value={bookingForm.bookingDate}
                      onChange={(e) =>
                        setBookingForm({
                          ...bookingForm,
                          bookingDate: e.target.value
                        })
                      }
                    />
                  </div>

                  <div>
                    <label>Booking Time</label>
                    <input
                      type="time"
                      value={bookingForm.bookingTime}
                      onChange={(e) =>
                        setBookingForm({
                          ...bookingForm,
                          bookingTime: e.target.value
                        })
                      }
                    />
                  </div>
                </div>

                <label>Booking Reference Number</label>
                <input
                  type="text"
                  placeholder="PNR / Booking ID"
                  value={bookingForm.referenceNumber}
                  onChange={(e) =>
                    setBookingForm({
                      ...bookingForm,
                      referenceNumber: e.target.value
                    })
                  }
                />

                <label>Additional Details</label>
                <textarea
                  placeholder="Add booking information..."
                  value={bookingForm.details}
                  onChange={(e) =>
                    setBookingForm({
                      ...bookingForm,
                      details: e.target.value
                    })
                  }
                />

                <button className="primary-button">
                  {editingBooking
                    ? "Update Booking"
                    : "Add Booking"}
                </button>

                {editingBooking && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setEditingBooking(null);
                      setBookingForm({
                        bookingType: "Flight",
                        title: "",
                        bookingDate: "",
                        bookingTime: "",
                        referenceNumber: "",
                        details: "",
                        bookingDetails: {}
                      });
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </form>

              <div className="booking-list">
                {(selectedTrip.bookings || []).length === 0 ? (
                  <p className="muted-text">
                    No bookings added yet.
                  </p>
                ) : (
                  selectedTrip.bookings.map((booking) => (
                    <div
                      className="booking-card"
                      key={booking._id}
                    >
                      <div>
                        <span className="category-label">
                          {booking.bookingType}
                        </span>

                        <h3>{booking.title}</h3>
                        <p>{formatDate(booking.bookingDate)}</p>
                        <p>{booking.bookingTime}</p>
                        <p>
                          Reference: {booking.referenceNumber || "N/A"}
                        </p>
                        <p>{booking.details}</p>
                      {Object.entries(booking.bookingDetails || {}).map(([key, value]) =>
  value ? (
    <p key={key}>
      <strong>
        {key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}:
      </strong>{" "}
      {value}
    </p>
  ) : null
)}
                      
                      </div>

                      <div className="action-buttons">
                        <button
                          onClick={() => startEditBooking(booking)}
                        >
                          Edit
                        </button>

                        <button
                          className="delete-text-button"
                          onClick={() =>
                            deleteBooking(booking._id)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* WEATHER */}

            <section className="content-card">
              <h2>🌤️ Destination Weather</h2>

              <p>
                Check current weather and a seven-day forecast for{" "}
                {selectedTrip.destination}.
              </p>

              <button
                className="primary-button"
                onClick={handleWeather}
                disabled={weatherLoading}
              >
                {weatherLoading
                  ? "Checking Weather..."
                  : "Check Weather"}
              </button>

              {weatherError && (
                <p className="error-message">{weatherError}</p>
              )}

              {weather && (
                <div className="weather-panel">
                  <h3>{weather.placeName}</h3>

                  <div className="weather-current">
                    <div>
                      <span>🌡️</span>
                      <strong>
                        {weather.current.temperature_2m}°C
                      </strong>
                      <p>
                        {weatherDescription(
                          weather.current.weather_code
                        )}
                      </p>
                    </div>

                    <div>
                      <span>💧</span>
                      <strong>
                        {weather.current.relative_humidity_2m}%
                      </strong>
                      <p>Humidity</p>
                    </div>

                    <div>
                      <span>💨</span>
                      <strong>
                        {weather.current.wind_speed_10m} km/h
                      </strong>
                      <p>Wind speed</p>
                    </div>
                  </div>

                  <h3>Weather Suggestions</h3>
                  <p>
                    {getWeatherSuggestion(
                      weather.current.weather_code
                    )}
                  </p>

                  <h3>7-Day Forecast</h3>

                  <div className="forecast-grid">
                    {weather.daily.time.map((day, index) => (
                      <div className="forecast-card" key={day}>
                        <strong>
                          {new Date(
                            day + "T00:00:00"
                          ).toLocaleDateString("en-IN", {
                            weekday: "short"
                          })}
                        </strong>

                        <p>
                          {weatherDescription(
                            weather.daily.weather_code[index]
                          )}
                        </p>

                        <p>
                          {weather.daily.temperature_2m_max[index]}° /{" "}
                          {weather.daily.temperature_2m_min[index]}°C
                        </p>

                        <p>
                          Rain chance:{" "}
                          {weather.daily.precipitation_probability_max[index]}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* MAP */}

            <section className="content-card">
              <h2>🗺️ Destination Map</h2>
              <p>Explore the location of your destination.</p>

              <button
                className="primary-button"
                onClick={handleShowMap}
                disabled={mapLoading}
              >
                {mapLoading
                  ? "Finding Destination..."
                  : "View Destination on Map"}
              </button>

              {mapError && (
                <p className="error-message">{mapError}</p>
              )}

              {mapLocation && (
                <div className="trip-map-section">
                  <h3>{mapLocation.name}</h3>

                  <MapContainer
                    center={[
                      mapLocation.latitude,
                      mapLocation.longitude
                    ]}
                    zoom={11}
                    scrollWheelZoom={false}
                    className="trip-map-container"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <Marker
                      position={[
                        mapLocation.latitude,
                        mapLocation.longitude
                      ]}
                      icon={markerIcon}
                    >
                      <Popup>{mapLocation.name}</Popup>
                    </Marker>
                  </MapContainer>

                  <p className="map-coordinates">
                    Latitude: {mapLocation.latitude} | Longitude:{" "}
                    {mapLocation.longitude}
                  </p>
                </div>
              )}
            </section>

            {/* REFLECTIONS */}

            <section className="content-card">
              <h2>📝 Daily Reflections & Memories</h2>

              <p>
                Write about your experiences, favourite moments and
                highlights from this journey.
              </p>

              <textarea
                className="reflection-textarea"
                placeholder="What made this trip special? Write your memories here..."
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
              />

              <button
                className="primary-button"
                onClick={saveReflection}
              >
                Save Reflections
              </button>
            </section>

            {/* SHARE */}

            <section className="content-card share-section">
              <h2>🔗 Share Your Travel Story</h2>

              <p>
                Create a public read-only link to share your travel
                memories with friends and family.
              </p>

              {selectedTrip.isShared && (
                <p className="success-message">
                  This trip is currently shared publicly.
                </p>
              )}

              <div className="share-actions">
                <button
                  className="primary-button"
                  onClick={handleGenerateShareLink}
                >
                  Generate / Copy Share Link
                </button>

                {selectedTrip.isShared && (
                  <button
                    className="delete-button"
                    onClick={handleDisableSharing}
                  >
                    Disable Sharing
                  </button>
                )}
              </div>
            </section>

            <button
              className="delete-trip-button"
              onClick={() => deleteTrip(selectedTrip._id)}
            >
              Delete This Trip
            </button>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>Dynamic Travel Storyboard © 2026</p>
        <p>Every journey has a story. Make yours unforgettable.</p>
      </footer>
    </div>
  );
}

export default App;
