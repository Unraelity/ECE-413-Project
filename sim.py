from ap import AP
from stationNew import Station
from channel import Channel

# PARAMETERS
DATA_FRAME_SIZE = 12000 # in bits (1500 bytes * 8 bits/bytes = 12000)
SLOT_DURATION = 0.000010 # in seconds (10 microseconds)
BANDIWDTH = 12000000 # in bps (12 Mbps)
RTS = 3 # slots
CTS = 3 # slots
SIMULATION_TIME = 10 # in seconds

# run the simulation
def run_simulation():

    currFrame = 0

    channel = Channel()

    ap = AP("AP1")

    A = Station("A", ap)
    B = Station("B", ap)

    ap.setTransmitting(A)
    nextStation = B

    while True:
        break



if __name__ == "__main__":
    run_simulation()