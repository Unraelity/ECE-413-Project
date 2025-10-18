from enum import Enum
import random

DIFS_SLOTS = 3 # slots
SIFS_SLOTS = 1 # slots
ACK_SLOTS = 2 # slots
CW_NOT = 8 # slots
CW_MAX = 1024 # slots

class Station:

    # represents the current state of the station
    class State(Enum):
        IDLE = 0 # waiting for a frame to send
        DIFS = 1 # waiting to countdown backoff or transmit after other station completed transmission
        BACKINGOFF = 2 # backing-off before sending
        TRANSMITTING = 3 # when station is transmitting
        # FROZEN will only be used when the station is in the same AP
        FROZEN = 4 # freezing tranmission (will not decrement backoff timer)
        SIFS = 5 # countdown before receving ACK
        WAITFORACK = 6 # waiting to receive ACK


    def __init__(self, id, ap, startInDIF = True):

        self.id = id
        # set start contention window to minimum
        self.cw = CW_NOT

        # set ap in station and add station to ap's associated stations
        self.ap = ap
        self.ap.addToAssociatedStations(self.id)

        # if startInDIF is true, station will start in DIFS state, else start in IDLE state
        # this essentially makes it so if we want to program to start transmission when it begins then we can
        if (startInDIF):
            self.state = self.State.DIFS
        else:
            self.state = self.State.IDLE

        # set all counters to 0
        self.backoffTimer = 0
        self.frozenTimer = 0
        self.sifsTimer = 0
        self.difsTimer = 0

        self.ackReceived = False

    def getCW(self):
        return random.randint(0, self.cw - 1)

    # channel will notify station when there is a collision
    def collision(self, station):

        print(f"Station {self.id}: Collision detected with {station.id}.")
        # make sure contention window does not exceed max
        self.cw = min(self.cw * 2, CW_MAX)
        self.toBackOff()

    def receiveACK(self):
        print(f"Station {self.id}: ACK received.")
        self.ackReceived = True

    # called when DIFS reaches 0
    def checkIfCanTransmit(self):
        
        if (self.backoffTimer <= 0):
            self.state = self.State.IDLE
        else:
            self.state = self.State.BACKINGOFF
            self.toBackOff()


    # STATE MACHINE TRANSITIONS
    # set station to BACKOFF state and get a new backoff timer
    def toBackOff(self):
        self.state = self.State.BACKINGOFF
        self.backoffTimer = self.getCW()
    
    # set station to DIFS state and reset DIFS timer
    def toDIFS(self):
        self.state = self.State.DIFS
        self.difsTimer = DIFS_SLOTS
    
    def toFrozen(self):
        # frozen time will be other station's tranmission time + SIFS + ACK then at the end go to DIFS
        print("NOT IMPLEMENTED: toFrozen")

    # set station to SIFS state and reset SIFS timer
    def toSIFS(self):
        self.state = self.State.SIFS
        self.sifsTimer = SIFS_SLOTS

    # set station to WAITFORACK state and reset waiting for ACK timer
    def toWaitForACK(self):
        self.state = self.State.WAITFORACK
        self.ackTimer = ACK_SLOTS


    # STATE MACHINE HANDLERS
    # decide which state handler to call
    def handleState(self):
        
        if self.state == self.State.IDLE:
            self.handleIdle()
        elif self.state == self.State.DIFS:
            self.handleDIFS()
        elif self.state == self.State.BACKINGOFF:
            self.handleBackOff()
        elif self.state == self.State.FROZEN:
            self.handleFrozen()
        elif self.state == self.State.SIFS:
            self.handleSIFS()
        elif self.state == self.State.WAITFORACK:
            self.handleWaitForACK()
        else:
            print("ERROR: Invalid State")
    
    # in idle state, station will try to transmit
    def handleIdle(self, channel):

        # if channel is clear
        if (channel.listenToChannel(self)):
            # transmit
            self.state = self.State.TRANSMITTING
            channel.setTransmitting(self)

    def handleDIFS(self):

        self.difsTimer -= 1
        if (self.difsTimer >= 0):

            if (self.backoffTimer <= 0):
                print(f"Station {self.id}: DIFS timer has reached 0, checking if can transmit or should backoff.")
                self.checkIfCanTransmit()

    # countdown backoff timer
    def handleBackOff(self):

        # if backoff timer is greater than 0
        if (self.backoffTimer > 0):
            # decrement it
            self.backoffTimer -= 1
        else:
            # once backoff timer is 0, set to IDLE (to get ready to transmit)
            print(f"Station {self.id}: Has reached a backoff of 0, going to IDLE state.")
            self.state = self.State.IDLE

    def handleTransmitting(self):
        # if finished transmitting -> reset cw and go to SIFS
        print("NOT IMPLEMENTED: handleTransmitting")

    def handleFrozen(self):
        # if frozen timer is less than or equal to 0, go to DIFS state
        if (self.frozenTimer <= 0):
            self.state = self.State.DIFS

    # if timer is at 0, go move to DIFS state
    def handleSIFS(self):

        self.sifsTimer -= 1
        if (self.sifsTimer >= 0):

            print(f"Station {self.id}: Finished SIFS moving to ACK.")

            self.toWaitForACK()

    # if timer is at 0, check is ACK was received then go to DIFS state
    def handleWaitForACK(self):

        self.ackTimer -= 1
        if (self.ackTimer >= 0):

            print(f"Station {self.id}: Finished waiting for ACK.")

            # if ACK was received, reset contention window
            if (self.ackReceived):
                self.cw = CW_NOT
            # else double contention window
            else:
                # make sure contention window does not exceed max
                self.cw = min(self.cw * 2, CW_MAX)
                print(f"Station {self.id}: Did not receive ACK, doubling contention window to {self.cw} and going to DIFS.")
            
            self.toDIFS()
