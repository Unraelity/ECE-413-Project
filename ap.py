class AP: 
    def __init__(self, id):
        self.id = id
        self.associated_stations = []

    # add station id to list of associated stations (stations that can communicate with this AP)
    def addToAssociatedStations(self, stationID):
        self.associated_stations.append(stationID)
    
    # checks if station's id is in list of associated stations
    def isAnAssociatedStation(self, stationID):
        if stationID in self.associated_stations:
            return True
        return False
