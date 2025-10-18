import numpy as np
import heapq
import random
import math
from station import Station

# -------------------------------------------------------------
# CONSTANTS (time units in microseconds)
# -------------------------------------------------------------
SLOT_TIME = 10        # Each slot time = 10 µs
SIFS = 1 * SLOT_TIME  # Short Inter-Frame Space
DIFS = 3 * SLOT_TIME  # Distributed Inter-Frame Space
FRAME_TX_TIME = 200   # Time taken to send one frame (200 µs)
BANDWIDTH = 12e6      # Channel bandwidth = 12 Mbps
ACK_TX_TIME = 2 * SLOT_TIME  # ACK takes 2 slots
MAX_RETRIES = 7              # max retransmissions per frame



# creates multiple Station objects (A, B)
def create_stations(lambda_rate, sim_time, slot_duration, station_ids=["A", "B"], max_retries=7):
    return [Station(sid, lambda_rate, sim_time, slot_duration, max_retries=max_retries) for sid in station_ids]

# -------------------------------------------------------------
# will represent an event in the simulation (ex: frame ready, transmission)
# -------------------------------------------------------------
class Event:
    def __init__(self, time, event_type, station_id, frame_id=None):
        self.time = time
        self.event_type = event_type
        self.station_id = station_id
        self.frame_id = frame_id

    def __lt__(self, other):
        # For heap queue sorting (earlier events first)
        return self.time < other.time


# -------------------------------------------------------------
# Manages events in order using a priority queue
# -------------------------------------------------------------
class EventQueue:
    def __init__(self):
        self.queue = []

    def push(self, event):
        heapq.heappush(self.queue, event)  # Add new event

    def pop(self):
        # Take the next earliest event
        if self.queue:
            return heapq.heappop(self.queue)
        return None

    def is_empty(self):
        return len(self.queue) == 0

# -------------------------------------------------------------
# begin simulation of CSMA/CA protocol between stations
# -------------------------------------------------------------
def csma_ca_simulation(stations, sim_time, slot_duration):
    current_time = 0  # in slots
    channel_busy_time = 0
    all_delays = []

    # Visibility map for hidden terminals
    visibility = {
        "A": ["AP"],
        "B": ["AP"],
        "AP": ["A", "B"]
    }

    while current_time < sim_time / slot_duration:
        # Find stations with frames ready
        ready_stations = [s for s in stations if s.has_frame_ready(current_time)]

        # Determine perceived channel state for each station
        busy_for = {s.id: False for s in stations}
        for s in stations:
            for other in stations:
                if other.id in visibility[s.id] and other.state == "TRANSMITTING":
                    busy_for[s.id] = True

        # Stations that think channel is idle
        idle_stations = [s for s in ready_stations if not busy_for[s.id]]

        if idle_stations:
            # Assign backoff
            for s in idle_stations:
                if s.state == "IDLE":
                    s.start_backoff()
                    s.state = "BACKOFF"

            # Find station(s) whose backoff expires first
            min_backoff = min(s.backoff for s in idle_stations)
            contenders = [s for s in idle_stations if s.backoff == min_backoff]

            # Advance time by DIFS + backoff
            current_time += DIFS + min_backoff * SLOT_TIME

            # --- Collision handling ---
            if len(contenders) > 1:
                print(f"COLLISION at AP at t={current_time} from {[s.id for s in contenders]}")
                for s in contenders:
                    frame_index = 0
                    s.increment_retry(frame_index)
                    s.collision_count += 1
                    if s.max_retries_reached(frame_index):
                        print(f"Frame dropped for station {s.id} after {MAX_RETRIES} retries")
                        s.queue.pop(frame_index)
                        s.retry_counts.pop(frame_index)
                        s.state = "IDLE"
                    else:
                        s.double_cw()
                        s.start_backoff()
                        s.queue[frame_index] = current_time + s.backoff * SLOT_TIME
                        s.state = "IDLE"
            else:
                # --- Successful transmission ---
                tx_station = contenders[0]
                tx_station.state = "TRANSMITTING"
                print(f"SUCCESS: Station {tx_station.id} transmitted frame at t={current_time}")

                # Track metrics
                tx_station.reset_cw()
                tx_station.success_count += 1

                # Delay includes frame + SIFS + ACK
                if tx_station.queue:
                    arrival_time = tx_station.queue[0]
                    delay = current_time - arrival_time + FRAME_TX_TIME + SIFS + ACK_TX_TIME
                    tx_station.delays.append(delay)
                    all_delays.append(delay)

                # Advance current_time for frame + SIFS + ACK
                current_time += FRAME_TX_TIME + SIFS + ACK_TX_TIME
                channel_busy_time += FRAME_TX_TIME + SIFS + ACK_TX_TIME

                # Remove frame and retry counter
                tx_station.queue.pop(0)
                tx_station.retry_counts.pop(0)
                tx_station.state = "IDLE"

        else:
            # No stations ready or all see channel busy
            # Jump to next frame arrival
            next_arrivals = [s.queue[0] for s in stations if s.queue]
            if next_arrivals:
                current_time = max(current_time + 1, min(next_arrivals))
            else:
                # No more frames to transmit
                break

    # --- Simulation Summary ---
    print("\n--- Simulation Finished ---")
    for s in stations:
        print(f"Station {s.id}: {s.success_count} successes, {s.collision_count} collisions")

    return {
        "channel_busy_time": channel_busy_time,
        "delays": all_delays
    }

# -------------------------------------------------------------
# MAIN 
# -------------------------------------------------------------
if __name__ == "__main__":
    slot_duration = 10e-6   # 10 microseconds per slot
    sim_time = 10           # 10 seconds total simulation time
    lambda_values = [100, 200, 300, 500, 800, 1000]  # Frame arrival rates (frames/sec)

    # Lists to store performance metrics for plotting
    collision_rates = []
    throughputs = []
    avg_delays = []
    utilizations = []

    # Run simulation for each λ value
    for lam in lambda_values:
        stations = create_stations(lam, sim_time, slot_duration, ["A", "B", "AP"])

        # Run CSMA/CA simulation
        metrics = csma_ca_simulation(stations, sim_time, slot_duration)

        # --- PERFORMANCE METRICS CALCULATION ---
        frame_size_bits = 1500 * 8  # 1500 bytes/frame = 12,000 bits
        total_success = sum(s.success_count for s in stations)
        total_collisions = sum(s.collision_count for s in stations)
        total_generated = sum(len(s.arrival_times) for s in stations)

        sim_time_s = sim_time
        # Throughput = (successful frames × bits per frame) / total time
        throughput_bps = (total_success * frame_size_bits) / sim_time_s
        # Collision rate = (# collisions) / (# frames generated)
        collision_rate = total_collisions / total_generated if total_generated > 0 else 0

        # Average delay = mean of all frame delays
        avg_delay = np.mean(metrics["delays"]) if metrics["delays"] else 0
        # Utilization = (time channel was busy) / (total time)
        utilization = metrics["channel_busy_time"] / (sim_time / slot_duration)

        # Store all metrics
        collision_rates.append(collision_rate)
        throughputs.append(throughput_bps / 1e6)  # Convert to Mbps
        avg_delays.append(avg_delay)
        utilizations.append(utilization)

        # Print summary for this λ
        print(f"\n--- Performance Metrics for λ={lam} ---")
        print(f"Total frames generated: {total_generated}")
        print(f"Total successful transmissions: {total_success}")
        print(f"Total collisions: {total_collisions}")
        print(f"Collision rate: {collision_rate:.3f}")
        print(f"Throughput: {throughput_bps/1e6:.3f} Mbps")
        print(f"Average delay: {avg_delay:.2f} μs")
        print(f"Channel utilization: {utilization:.3f}")

    # -------------------------------------------------------------
    # PLOT RESULTS: Show how performance changes with λ (traffic rate)
    # -------------------------------------------------------------
    plt.figure(figsize=(10, 6))
    plt.plot(lambda_values, throughputs, marker='o', label="Throughput (Mbps)")
    plt.plot(lambda_values, collision_rates, marker='x', label="Collision Rate")
    plt.plot(lambda_values, avg_delays, marker='s', label="Avg Delay (μs)")
    plt.plot(lambda_values, utilizations, marker='d', label="Channel Utilization")
    plt.xlabel("λ (frames/sec)")
    plt.ylabel("Metric Value")
    plt.title("CSMA/CA Performance Metrics vs Arrival Rate")
    plt.legend()
    plt.grid(True)


# -------------------------------------------------------------
# Plots 
# -------------------------------------------------------------
plt.figure()
plt.plot(lambda_values, throughputs, marker='o')
plt.xlabel("λ (frames/sec)")
plt.ylabel("Throughput (Mbps)")
plt.title("CSMA/CA Throughput vs Arrival Rate")
plt.grid(True)

plt.figure()
plt.plot(lambda_values, collision_rates, marker='o')
plt.xlabel("λ (frames/sec)")
plt.ylabel("Collision Rate")
plt.title("CSMA/CA Collision Rate vs Arrival Rate")
plt.grid(True)

plt.show()
