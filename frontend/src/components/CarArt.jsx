export default function CarArt({ category, id }) {
  const palette = {
    SUV: ["#dce2da", "#6e7e72"],
    Sedan: ["#d9dedc", "#60736c"],
    Coupe: ["#e0d8cf", "#89735d"],
    Electric: ["#dce5e3", "#637e80"],
    Truck: ["#e1ded8", "#77756b"],
  };
  const [sky, car] = palette[category] || ["#e3e1dc", "#797b74"];
  return (
    <div className="car-art" style={{ "--sky": sky }}>
      <span className="art-number">AM / {String(id).padStart(3, "0")}</span>
      <svg
        viewBox="0 0 570 245"
        role="img"
        aria-label={`${category} illustration`}
        className="car-svg"
      >
        <ellipse
          cx="286"
          cy="211"
          rx="230"
          ry="13"
          fill="#1b2725"
          opacity=".13"
        />
        <path
          d="M56 160 C68 149 97 143 132 139 L169 92 C180 79 202 74 232 73 L353 73 C378 73 397 83 411 99 L449 139 C481 141 510 149 520 163 L529 188 Q527 199 514 200 L61 200 Q49 196 49 184 Z"
          fill={car}
          stroke="#34453e"
          strokeWidth="3"
        />
        <path
          d="M175 139 L203 96 Q211 86 234 86 L276 86 L276 139 Z M289 86 L352 86 Q373 86 385 100 L417 139 L289 139 Z"
          fill="#c7d5d0"
          stroke="#3c524c"
          strokeWidth="3"
        />
        <path d="M278 85 L288 85 L288 141 L278 141 Z" fill="#465950" />
        <path
          d="M64 164 L102 163 L97 176 L53 176 M484 161 L520 166 L526 180 L482 179"
          fill="#eee1c3"
          stroke="#465950"
          strokeWidth="2"
        />
        <path
          d="M155 156 H414 M350 148 H374"
          stroke="#d6e0d9"
          strokeWidth="2"
          opacity=".55"
        />
        <circle cx="144" cy="194" r="31" fill="#26322d" />
        <circle cx="144" cy="194" r="17" fill="#a6ada5" />
        <circle cx="144" cy="194" r="7" fill="#44534b" />
        <circle cx="431" cy="194" r="31" fill="#26322d" />
        <circle cx="431" cy="194" r="17" fill="#a6ada5" />
        <circle cx="431" cy="194" r="7" fill="#44534b" />
      </svg>
      <span className="art-category">
        {category.toUpperCase()} / COLLECTION
      </span>
    </div>
  );
}
