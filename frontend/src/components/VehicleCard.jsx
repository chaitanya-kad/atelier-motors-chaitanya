import { ArrowDownRight, ArrowRight } from "lucide-react";
import { money } from "../api.js";
import CarArt from "./CarArt.jsx";

export default function VehicleCard({
  car,
  busy,
  isAdmin,
  onEdit,
  openAction,
}) {
  return (
    <article className="vehicle-card">
      <div className="card-image">
        <CarArt category={car.category} id={car.id} />
        <span className={car.quantity ? "stock-badge" : "stock-badge sold"}>
          <span /> {car.quantity ? `${car.quantity} IN STOCK` : "SOLD OUT"}
        </span>
      </div>
      <div className="card-body">
        <div className="card-heading">
          <div>
            <span className="car-index">
              {String(car.id).padStart(2, "0")} / {car.category.toUpperCase()}
            </span>
            <h3>
              {car.make} <span>{car.model}</span>
            </h3>
          </div>
          <span className="card-arrow">
            <ArrowDownRight size={21} />
          </span>
        </div>
        <div className="card-bottom">
          <div>
            <span className="price-label">PRICE</span>
            <strong>{money(car.price)}</strong>
          </div>
          <button
            disabled={!car.quantity || busy}
            className="purchase-button"
            aria-label={`Purchase ${car.make} ${car.model}`}
            onClick={() => {
              openAction("purchase", car);
            }}
          >
            {car.quantity ? "Purchase" : "Unavailable"} <ArrowRight size={16} />
          </button>
        </div>
        {isAdmin && (
          <div className="admin-actions">
            <button
              aria-label={`Edit ${car.make} ${car.model}`}
              onClick={() => onEdit(car)}
            >
              Edit details
            </button>
            <button
              aria-label={`Restock ${car.make} ${car.model}`}
              onClick={() => {
                openAction("restock", car);
              }}
            >
              Restock
            </button>
            <button
              aria-label={`Delete ${car.make} ${car.model}`}
              onClick={() => {
                openAction("delete", car);
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
