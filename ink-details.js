import * as THREE from './vendor/three.module.js';

// Fixed, coherent irregularities: duplicate vertices stay together and the
// artwork never flickers or changes when the animation is paused or scrubbed.
function inkPoint(x,y,z,amount){
  return new THREE.Vector3(
    x+amount.x*(.65*Math.sin(y*3.7+z*2.1)+.35*Math.sin(z*6.2)),
    y+amount.y*(.6*Math.sin(x*4.1+z*2.8)+.4*Math.cos(x*2.3)),
    z+amount.z*(.65*Math.sin(x*3.2+y*2.4)+.35*Math.cos(y*4.7))
  );
}
const layers=[
  [[-.47,-.16],[-.31,-.13],[-.12,-.17],[.08,-.15],[.27,-.19],[.46,-.16]],
  [[-.45,.18],[-.25,.14],[-.04,.17],[.17,.12],[.32,.15],[.48,.13]],
  [[-.37,-.34],[-.24,-.36],[-.13,-.32]],
  [[.14,.32],[.23,.29],[.34,.31]],
];
const cracks=[
  [[-.34,.3],[-.3,.14],[-.34,.04]],
  [[.27,-.03],[.31,-.14],[.29,-.29]],
  [[-.03,-.27],[.01,-.23],[.06,-.28]],
];

export function addInkDetails(mesh){
  const geometry=mesh.geometry;
  if(mesh.name==='descending-plate'||mesh.userData.outline||!['BoxGeometry','ConeGeometry','CylinderGeometry','SphereGeometry'].includes(geometry.type))return;
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox.clone(),size=new THREE.Vector3();bounds.getSize(size);
  // Preserve tiny foam, debris, conduits and helper arrows exactly.
  if(Math.max(size.x,size.y,size.z)<.4||Math.min(size.x,size.y,size.z)<.06)return;
  const amount={x:Math.min(.055,size.x*.035),y:Math.min(.025,size.y*.025),z:Math.min(.04,size.z*.025)};
  const position=geometry.attributes.position;
  for(let i=0;i<position.count;i++){
    const point=inkPoint(position.getX(i),position.getY(i),position.getZ(i),amount);
    position.setXYZ(i,point.x,point.y,point.z);
  }
  position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
  mesh.userData.inkSculpted=true;
  if(geometry.type!=='BoxGeometry'||size.x<.45||size.y<.3||size.z<.3)return;

  const strokes=[],center=new THREE.Vector3();bounds.getCenter(center);
  function frontPoint(point){
    const p=inkPoint(center.x+point[0]*size.x,center.y+point[1]*size.y,bounds.max.z,amount);
    p.z+=amount.z+.008;return p;
  }
  const patterns=size.x>size.y*2?layers.concat(cracks):cracks;
  for(const line of patterns)for(let i=1;i<line.length;i++)strokes.push(frontPoint(line[i-1]),frontPoint(line[i]));
  // Short, uneven pen hatches rather than a uniform repeating surface pattern.
  for(const [x,y] of [[-.42,-.31],[-.36,-.34],[.33,.29],[.39,.27]]){
    strokes.push(frontPoint([x,y]),frontPoint([x+.035,y+.12]));
  }
  const hatch=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(strokes),new THREE.LineBasicMaterial({color:0x514333,transparent:true,opacity:.65}));
  hatch.name='ink-surface-strokes';hatch.userData.outline=true;mesh.add(hatch);
}
