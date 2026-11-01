package sanatorium.core.directory;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Номер. Категория задаётся идентификатором (границы агрегатов), активность — признак участия в продаже. */
@Entity
@Table(name = "rooms")
public class Room implements DirectoryEntity<Room> {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private Integer id;

    @NotNull
    @Column(name = "category_id", nullable = false)
    private Integer categoryId;

    @NotBlank @Size(max = 10)
    @Column(name = "room_number", nullable = false)
    private String roomNumber;

    @Column(name = "floor")
    private Integer floor;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "status", nullable = false)
    private String status = "VACANT";

    @Column(name = "window_view")
    private String windowView;

    @Column(name = "amenities")
    private String amenities;

    @Column(name = "notes")
    private String notes;

    @Column(name = "building", nullable = false)
    private String building = "Главный спальный корпус";

    protected Room() { }

    public Room(int categoryId, String roomNumber, Integer floor) {
        this.categoryId = categoryId;
        this.roomNumber = roomNumber;
        this.floor = floor;
    }

    @Override
    public void copyFrom(Room s) {
        this.categoryId = s.categoryId;
        this.roomNumber = s.roomNumber;
        this.floor = s.floor;
        this.active = s.active;
        if (s.status != null) this.status = s.status;
        if (s.windowView != null) this.windowView = s.windowView;
        if (s.amenities != null) this.amenities = s.amenities;
        if (s.notes != null) this.notes = s.notes;
        if (s.building != null) this.building = s.building;
    }

    public Integer getId() { return id; }
    public Integer getCategoryId() { return categoryId; }
    public void setCategoryId(Integer categoryId) { this.categoryId = categoryId; }
    public String getRoomNumber() { return roomNumber; }
    public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }
    public Integer getFloor() { return floor; }
    public void setFloor(Integer floor) { this.floor = floor; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getWindowView() { return windowView; }
    public void setWindowView(String windowView) { this.windowView = windowView; }
    public String getAmenities() { return amenities; }
    public void setAmenities(String amenities) { this.amenities = amenities; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getBuilding() { return building; }
    public void setBuilding(String building) { this.building = building; }
}
