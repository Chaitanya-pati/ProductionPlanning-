# Whale Safe Emergency Alert System
## Technical Questions & Answers

---

## Q1: Which algorithms are used?

**Answer:** The system relies on several practical algorithms that coordinate its main functions:

- **Bit-Flagging Algorithm:** Stored messages are paired with binary flags in a database (0 or 1). This allows the software to quickly determine which message is active and should be sent in an emergency scenario. The flag system ensures only selected messages are transmitted and can easily be switched.

- **Contact Filtering Algorithm:** Contacts are displayed using a dynamic search function that sorts already-selected contacts to the top and uses case-insensitive matching. This makes it efficient for users to filter and select contacts, especially in real-time or under stress.

- **Location Retrieval and Caching Algorithm:** The app utilizes Google's Fused Location Provider to fetch the last known location from the device cache. This avoids battery drain associated with continuous GPS polling while ensuring quick access to a usable location during an alert.

- **Message Queueing Algorithm:** Emergency messages are sent at regular intervals (every 15 seconds, by default). Android's Handler and postDelayed() functions are used to maintain a queue of SMS messages, ensuring recipients receive repeated notifications if the emergency persists or following up on unacknowledged alerts.

---

## Q2: Which Bluetooth model is used for connecting devices (ESP32 or mobile)?

**Answer:** The solution uses **Bluetooth Classic** and communicates using the **Serial Port Profile (SPP)**. The key UUID is **00001101-0000-1000-8000-00805F9B34FB**, a common standard for serial data transfer.

The ESP32 microcontroller acts as a Bluetooth slave (peripheral) device, while the Android phone is the master (central) device. For security and ease, devices must be pre-paired via Android's Bluetooth settings before the emergency system can establish connections. Communication between ESP32 and mobile is managed using RFCOMM sockets, making it suitable for short command messages like "SEND_SMS" to trigger the alert workflow.

---

## Q3: Is there data storing cloud required or is it just a prototype of an IoT use case?

**Answer:** The current implementation is strictly a **prototype** and does **not require cloud storage**. All data—including emergency messages, contact numbers, and authentication PIN—is stored locally on the device using SQLite (**UserDatabase.db**).

This means user data does not leave the device, ensuring privacy but also limiting functionality. There is no cloud integration like Firebase or AWS, and thus:

- The system won't synchronize across multiple devices.
- Data cannot be backed up or shared centrally.
- There is no server-based alert or monitoring.

For mass deployment or real-world production, cloud features could support centralized alerting, real-time analytics, and improved reliability.

---

## Q4: How are the messages communicated offline?

**Answer:** The application's offline communication capability is based on SMS and Bluetooth technology:

- **Bluetooth Communication:** The ESP32 device sends a trigger command (e.g., "SEND_SMS") via Bluetooth to the Android phone. This communication is wireless and does not require internet access. The Bluetooth connection is maintained between devices that have already been paired.

- **SMS Transmission:** Once the Android phone receives the Bluetooth trigger, it sends SMS messages to selected contacts. SMS does not require internet but does need cellular network service. If the device has no SIM or signal, the SMS cannot be sent, which is a limitation in fully offline environments.

- **Location sharing in SMS:** The alert messages include a Google Maps URL (latitude and longitude), which can be used later to view the sender's location when cellular service is restored.

Messages are sent at regular intervals until cancelled, maintaining the emergency signal even if initial alerts are missed.

---

## Q5: How can the offline system fetch the last current location and how is this updated continuously?

**Answer:** The system retrieves location data using a pull-based approach when triggered, not through continuous tracking:

- When the emergency alert is activated, the application fetches the last known location using Google's Fused Location Provider. This is a one-time retrieval, pulling location data cached from previous device usage.

- This process is quick and battery-efficient but could result in stale location if the device has been stationary or the cache is old.

- All subsequent SMS alerts within the session use this same location value.

Currently, there is **no periodic location update**. For applications needing real-time tracking or vehicles in motion, a location request listener with defined intervals (e.g., every 5 seconds) would be necessary. As implemented, the system prioritizes speed and battery life over real-time geographic accuracy.

---

## Q6: How does authentication work, and what are its limitations?

**Answer:** The current authentication approach centers on a simple PIN mechanism:

- Users set a 4-digit PIN code during initial configuration.

- The PIN is only requested **when trying to cancel** an ongoing emergency alert—not before sending such an alert.

- There is no user authentication or authorization before initiating emergency messages, meaning any person with physical access to the phone can trigger alerts to all contacts without verification.

- This presents a security risk, as unauthorized alarms could be sent accidentally or maliciously.

**Improvement recommendations:** Implement two-factor authentication combining PIN and biometric verification (fingerprint, face recognition) before initiating an alert. This would address the problem of unauthorized usage and ensure only verified users can trigger emergency broadcasts.

---

## Q7: Brief process summary: how does each file work?

**Answer:** Here is an overview of key files and their main functions:

- **MainActivity.kt:** Entry point for the app, sets up navigation and loads fragments.

- **FirstFragment.kt:** Main alert interface, managing Bluetooth connection, PIN logic, location retrieval, and SMS sending.

- **SecondFragment.kt:** Configuration screen, handling contact selection, message editing, and PIN setup.

- **DatabaseHelper.kt:** Responsible for all database operations (CRUD on SQLite for contacts, messages, PIN).

- **MySingleton.kt:** Maintains connection and app-state data in memory.

- **Layout XML files:** Define visual structure including buttons, fields, and lists.

Functions depend on user action (button press), Bluetooth event (command received), or system event (location update) to start the appropriate workflow.

---

## Q8: Which file causes the function to perform certain operations?

**Answer:** The operational flow for the emergency workflow is as follows:

1. **activity_home.xml** button press triggers **FirstFragment.btnSendCancel.setOnClickListener**.

2. **FirstFragment.kt** initiates **checkLocationAndSendMessage()**.

3. **DatabaseHelper.kt** fetches data from SQLite.

4. **FusedLocationProviderClient** retrieves location data.

5. **FirstFragment.kt** manages the countdown and SMS sequencing.

6. **SmsManager** handles the actual sending of text messages to contacts.

7. **MySingleton.kt** keeps Bluetooth and process state information accessible across components.

Each file is responsible for a part of the process, with FirstFragment.kt at the core of the alert trigger and message workflow.

---

*Document Generated: November 3, 2025*
