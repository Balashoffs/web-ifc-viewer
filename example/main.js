import { CameraProjections, IfcViewerAPI } from 'web-ifc-viewer';
import { createSideMenuButton } from './utils/gui-creator';
import {
  IFCSPACE, IFCOPENINGELEMENT, IFCFURNISHINGELEMENT, IFCWALL, IFCWINDOW, IFCCURTAINWALL, IFCMEMBER, IFCPLATE
} from 'web-ifc';
import {
  MeshBasicMaterial,
  LineBasicMaterial,
  Color,
  Vector2,
  DepthTexture,
  WebGLRenderTarget, Material, BufferGeometry, BufferAttribute, Mesh
} from 'three';
import { ClippingEdges } from 'web-ifc-viewer/dist/components/display/clipping-planes/clipping-edges';
import Stats from 'stats.js/src/Stats';
import { Points } from 'three';
import { NavCube } from "./NavCube/NavCube";

const container = document.getElementById('viewer-container');
const viewer = new IfcViewerAPI({ container, backgroundColor: new Color(255, 255, 255) });
viewer.axes.setAxes();
// viewer.grid.setGrid();
viewer.shadowDropper.darkness = 1.5;

// Set up stats
const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.right = '0px';
stats.dom.style.left = 'auto';
viewer.context.stats = stats;

viewer.context.ifcCamera.cameraControls

const manager = viewer.IFC.loader.ifcManager;
const propsGUI = document.getElementById("ifc-property-menu-root");


viewer.IFC.setWasmPath('files/');

viewer.IFC.loader.ifcManager.applyWebIfcConfig({
  USE_FAST_BOOLS: true,
  COORDINATE_TO_ORIGIN: true
});

viewer.context.renderer.postProduction.active = true;

// Setup loader

// const lineMaterial = new LineBasicMaterial({ color: 0x555555 });
// const baseMaterial = new MeshBasicMaterial({ color: 0xffffff, side: 2 });

let first = true;
let model;

const loadIfc = async (event) => {

  // tests with glTF
  // const file = event.target.files[0];
  // const url = URL.createObjectURL(file);
  // const result = await viewer.GLTF.exportIfcFileAsGltf({ ifcFileUrl: url });
  //
  // const link = document.createElement('a');
  // link.download = `${file.name}.gltf`;
  // document.body.appendChild(link);
  //
  // for(const levelName in result.gltf) {
  //   const level = result.gltf[levelName];
  //   for(const categoryName in level) {
  //     const category = level[categoryName];
  //     link.href = URL.createObjectURL(category.file);
  //     link.click();
  //   }
  // }
  //
  // link.remove();
  const viewerL = viewer;
  const selectedFile = event.target.files[0];
  if (!selectedFile) return;

  const overlay = document.getElementById('loading-overlay');
  const progressText = document.getElementById('loading-progress');

  overlay.classList.remove('hidden');
  progressText.innerText = `Loading`;

  viewerL.IFC.loader.ifcManager.setOnProgress((event) => {
    const percentage = Math.floor((event.loaded * 100) / event.total);
    progressText.innerText = `Loaded ${percentage}%`;
  });

  viewerL.IFC.loader.ifcManager.parser.setupOptionalCategories({
    [IFCSPACE]: false,
    [IFCOPENINGELEMENT]: false
  });

  model = await viewerL.IFC.loadIfc(selectedFile, false);
  // model.material.forEach(mat => mat.side = 2);

  if (first) first = false
  else {
    ClippingEdges.forceStyleUpdate = true;
  }

  // await createFill(model.modelID);
  // viewer.edges.create(`${model.modelID}`, model.modelID, lineMaterial, baseMaterial);

  await viewerL.shadowDropper.renderShadow(model.modelID);

  overlay.classList.add('hidden');

  viewerL.container = container;
  const navCube = new NavCube(viewer);
  navCube.onPick(model);

};

function createTreeMenu(ifcProject) {
  const root = document.getElementById("tree-root");
  removeAllChildren(root);
  const ifcProjectNode = createNestedChild(root, ifcProject);
  ifcProject.children.forEach(child => {
    constructTreeMenuNode(ifcProjectNode, child);
  })
}

function nodeToString(node) {
  return `${node.type} - ${node.expressID}`
}

function constructTreeMenuNode(parent, node) {
  const children = node.children;
  if (children.length === 0) {
    createSimpleChild(parent, node);
    return;
  }
  const nodeElement = createNestedChild(parent, node);
  children.forEach(child => {
    constructTreeMenuNode(nodeElement, child);
  })
}

function createNestedChild(parent, node) {
  const content = nodeToString(node);
  const root = document.createElement('li');
  createTitle(root, content);
  const childrenContainer = document.createElement('ul');
  childrenContainer.classList.add("nested");
  root.appendChild(childrenContainer);
  parent.appendChild(root);
  return childrenContainer;
}

function createTitle(parent, content) {
  const title = document.createElement("span");
  title.classList.add("caret");
  title.onclick = () => {
    title.parentElement.querySelector(".nested").classList.toggle("active");
    title.classList.toggle("caret-down");
  }
  title.textContent = content;
  parent.appendChild(title);
}

function createSimpleChild(parent, node) {
  const content = nodeToString(node);
  const childNode = document.createElement('li');
  childNode.classList.add('leaf-node');
  childNode.textContent = content;
  parent.appendChild(childNode);

  childNode.onmouseenter = () => {
    viewer.IFC.selector.prepickIfcItemsByID(0, [node.expressID]);
  }

  childNode.onclick = async () => {
    viewer.IFC.selector.highlightIfcItemsByID(0, [node.expressID], true, true);
    const props = await viewer.IFC.getProperties(model.modelID, node.expressID, true, false);
    propsGUI.style.display = 'block';
    createPropertiesMenu(props);
  }
}

function removeAllChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

const inputElement = document.createElement('input');
inputElement.setAttribute('type', 'file');
inputElement.classList.add('hidden');
inputElement.addEventListener('change', loadIfc, false);

const handleKeyDown = async (event) => {
  if (event.code === 'Delete') {
    viewer.clipper.deletePlane();
    viewer.dimensions.delete();
  }
  if (event.code === 'Escape') {
    viewer.IFC.selector.unHighlightIfcItems();
  }
  if (event.code === 'KeyC') {
    viewer.context.ifcCamera.toggleProjection();
  }
  if (event.code === 'KeyD') {
    viewer.IFC.removeIfcModel(0);
    console.log(model);
  }
};


function createPropertiesMenu(properties) {
  console.log(properties);

  removeAllChildren(propsGUI);

  const psets = properties.psets;
  const mats = properties.mats;
  const type = properties.type;

  // delete properties.psets;
  // delete properties.mats;
  // delete properties.type;


  for (let key in properties) {
    createPropertyEntry(key, properties[key]);
  }

}

function createPropertyEntry(key, value) {
  const propContainer = document.createElement("div");
  propContainer.classList.add("ifc-property-item");

  if (value === null || value === undefined) value = "undefined";
  else if (value.value) value = value.value;

  const keyElement = document.createElement("div");
  keyElement.textContent = key;
  propContainer.appendChild(keyElement);

  const valueElement = document.createElement("div");
  valueElement.classList.add("ifc-property-value");
  valueElement.textContent = value;
  propContainer.appendChild(valueElement);

  propsGUI.appendChild(propContainer);
}

// function removeAllChildren(element) {
//     while (element.firstChild) {
//         element.removeChild(element.firstChild);
//     }
// }


window.onmousemove = () => viewer.IFC.selector.prePickIfcItem();
window.onkeydown = handleKeyDown;
window.ondblclick = async () => {

  if (viewer.clipper.active) {
    viewer.clipper.createPlane();
  }
  else {
    const result = await viewer.IFC.selector.highlightIfcItem(true);
    console.log(result);
    if (!result) {
      removeAllChildren(propsGUI);
      propsGUI.style.display = 'none';
      viewer.IFC.selector.unHighlightIfcItems();
      return;
    }
    propsGUI.style.display = 'block';
    const { modelID, id } = result;
    const props = await viewer.IFC.getProperties(modelID, id, true, false);
    createPropertiesMenu(props);
  }
};



//Setup UI
const loadButton = createSideMenuButton('./resources/svg/download.svg');
loadButton.addEventListener('click', () => {
  loadButton.blur();
  inputElement.click();
});

const sectionButton = createSideMenuButton('./resources/svg/view_timeline.svg');
sectionButton.addEventListener('click', () => {
  sectionButton.blur();
  viewer.clipper.toggle();
});

let isIfcTreeShow = false;

const model_tree = createSideMenuButton('./resources/svg/account_tree.svg');
model_tree.addEventListener('click', () => {
  if (model) {
    model_tree.blur();
    removeAllChildren(propsGUI);
    const ifcTree = document.getElementById('ifc-tree-menu');
    isIfcTreeShow = !isIfcTreeShow;
    propsGUI.style.display = isIfcTreeShow ? 'block' : 'none';
    ifcTree.style.display = isIfcTreeShow ? 'block' : 'none';
    console.log('propsGUI: ' + propsGUI.style.display);
    console.log('ifcTree: ' + ifcTree.style.display);
    viewer.IFC.selector.unHighlightIfcItems();
    if (isIfcTreeShow) {
      const toggler = document.getElementsByClassName("caret");
      for (let i = 0; i < toggler.length; i++) {
        toggler[i].onclick = () => {
          toggler[i].parentElement.querySelector(".nested").classList.toggle("active");
          toggler[i].classList.toggle("caret-down");
        }
      }

      viewer.IFC.getSpatialStructure(model.modelID).then(ifcProject => {
        console.log(ifcProject);
        createTreeMenu(ifcProject);
      });
    }
  }
});



const orthographicViewButton = createSideMenuButton('./resources/svg/cameraswitch.svg');
orthographicViewButton.addEventListener('click', () => {
  orthographicViewButton.blur();
  viewer.context.ifcCamera.toggleProjection();
});

// const visibilityButton = createSideMenuButton('./resources/svg/visibility.svg');
// visibilityButton.addEventListener('click', () => {
//   visibilityButton.blur();

// });

// const layersClearButton = createSideMenuButton('./resources/svg/layers_clear.svg');
// layersClearButton.addEventListener('click', () => {
//   layersClearButton.blur();
//   initIfcLoader();
// });

// const arrowBackButton = createSideMenuButton('./resources/svg/arrow_back.svg');
// arrowBackButton.addEventListener('click', () => {
//   arrowBackButton.blur();

// });