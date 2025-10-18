class Channel:

    def __init__(self):
        self.station_transmitting = None

    def listenToChannel(self, stationListening):

        # if no station is transmitting or the station transmitting is not the station that is listening's AP
        if (self.station_transmitting is None) or (stationListening.isAnAssociatedStation(self.station_transmitting.id)):
            # return channel is clear
            return True
        
        return False

    def setTransmitting(self, station):

        # if the current channel has a station transmitting, return false
        if self.station_transmitting is not None:
            return False
        
        self.station_transmitting = station
        print(f"Channel: Station {station.id} is now transmitting.")

    