import numpy as np
import random

class Station:
    def __init__(self, station_id, lambda_rate, sim_time, slot_duration, cw_min=8, cw_max=1024,max_retries=7):
        self.id = station_id
        self.lambda_rate = lambda_rate
        self.sim_time = sim_time
        self.slot_duration = slot_duration
        self.cw_min = cw_min
        self.cw_max = cw_max
        self.cw = cw_min
        self.state = "IDLE"
        self.success_count = 0
        self.collision_count = 0
        self.backoff = 0
        self.delays = []
        self.max_retries = max_retries  # store in the object
        self.ack_received = 0
        # Generate arrivals first
        self.arrival_times = self.generate_poisson_arrivals(lambda_rate, sim_time, slot_duration)

        # Initialize queue and retry count
        self.queue = list(self.arrival_times)
        self.retry_counts = [0] * len(self.queue)

    # -------------------------------------------------------------
    # Generate random Poisson-distributed frame arrivals
    # -------------------------------------------------------------
    def generate_poisson_arrivals(self, lmbda, sim_time, slot_duration):
        np.random.seed(random.randint(0, 99999))
        num_frames = int(lmbda * sim_time)
        U = np.random.rand(num_frames)

        X = -1 / lmbda * np.log(1 - U)  # exponential inter-arrival times
        arrival_times_sec = np.cumsum(X)
        arrival_times_slots = (arrival_times_sec / slot_duration).astype(int)
        arrival_times_slots = arrival_times_slots[arrival_times_slots < sim_time / slot_duration]
        return arrival_times_slots

    # -------------------------------------------------------------
    # Check if this station has a frame ready to send
    # -------------------------------------------------------------
    def has_frame_ready(self, current_time):
        return len(self.queue) > 0 and self.queue[0] <= current_time

    # -------------------------------------------------------------
    # Start a random backoff countdown
    # -------------------------------------------------------------
    def start_backoff(self):
        self.backoff = random.randint(0, self.cw - 1)

    # -------------------------------------------------------------
    # Collision handling (binary exponential backoff)
    # -------------------------------------------------------------
    def double_cw(self):
        self.cw = min(self.cw * 2, self.cw_max)

    # -------------------------------------------------------------
    # Reset contention window after success
    # -------------------------------------------------------------
    def reset_cw(self):
        self.cw = self.cw_min
    
    def increment_retry(self, frame_index):
        self.retry_counts[frame_index] += 1

    def max_retries_reached(self, frame_index):
        return self.retry_counts[frame_index] >= self.max_retries
