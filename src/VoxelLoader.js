/**
 * @author André Storhaug <andr3.storhaug@gmail.com>
 */

import autoBind from 'auto-bind';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils'
import { BoxGeometry, Vector3, Mesh, VertexColors, MeshPhongMaterial } from 'three';
import { LoaderFactory } from "./loaders/LoaderFactory";
import { levelOfDetail } from './mixins/levelOfDetail';

export class VoxelLoader {
  /**
   * Create a VoxelLoader.
   * @classdesc Class for loading voxel data stored in various formats.
   * @param {LoadingManager} manager
   * @mixes levelOfDetail
   */
  constructor(manager) {
    autoBind(this);

    Object.assign(this, levelOfDetail);
    this.manager = manager;
    this.octree = null;
    this.material = null;
    this.voxelSize = null;

    this.setVoxelMaterial();
    this.setVoxelSize();
  }

  /**
   * Set the material used for all voxels.
   * Note that the {@link Material.vertexColors} will be set to {@link VertexColors}.
   * @param {Material} Material The wanted material.
   */
  setVoxelMaterial(material) {
    let defaultMaterial = new MeshPhongMaterial({
      color: 0xffffff
    });

    material = typeof material !== 'undefined' ? material : defaultMaterial;
    material.vertexColors = VertexColors
    this.material = material;
  }

  /**
   * Set the size of the cubes representing voxels generated in {@link VoxelLoader#generateMesh}.
   * @param {float} [voxelSize=1]
   */
  setVoxelSize(voxelSize = 1) {
    this.voxelSize = voxelSize;
  }

  /**
   * Loads and parses a 3D model file from a URL.
   *
   * @param {String} url - URL to the VOX file.
   * @param {Function} [onLoad] - Callback invoked with the Mesh object.
   * @param {Function} [onProgress] - Callback for download progress.
   * @param {Function} [onError] - Callback for download errors.
   */
  loadFile(url, onLoad, onProgress, onError) {
    let scope = this

    scope.loadOctree(url, onProgress)
      .then(octree => onLoad && onLoad(scope.generateMesh(octree)))
      .catch(error => onError && onError(error))
  }


  loadOctree(url, onProgress) {
    let scope = this

    return new Promise((resolve, reject) => {
      let extension = url.split('.').pop().toLowerCase()
      let loaderFactory = new LoaderFactory(this.manager)
      let loader = loaderFactory.getLoader(extension)
      loader.setLOD(this.LOD.maxPoints, this.LOD.maxDepth)

      loader.load(url,
        octree => resolve(scope.octree = octree),
        xhr => onProgress && onProgress(xhr),
        error => reject(error))
    })
  }

  /**
   * Generates a polygon mesh with cubes based on voxel data.
   * One cube for each voxel.
   * @param {PointOctree} octree Octree with voxel data stored as points in space.
   * @returns {Mesh} 3D mesh based on voxel data
   */
  generateMesh(octree) {

    let mergedGeometry
    const material = this.material;

    for (const leaf of octree.leaves()) {
      if (leaf?.data?.points?.length) {
        const pos = new Vector3();
        var i;
        let min = { x: leaf.data.points[0].x, y: leaf.data.points[0].y, z: leaf.data.points[0].z };
        let max = { x: leaf.data.points[0].x, y: leaf.data.points[0].y, z: leaf.data.points[0].z };

        for (i = 0; i < leaf.data.points.length; i++) {
          const point = leaf.data.points[i];
          pos.add(point);
          min.x = Math.min(min.x, point.x);
          min.y = Math.min(min.y, point.y);
          min.z = Math.min(min.z, point.z);
          max.x = Math.max(max.x, point.x);
          max.y = Math.max(max.y, point.y);
          max.z = Math.max(max.z, point.z);
        }

        let width = Math.round((this.voxelSize + (max.x - min.x)) * 100) / 100;;
        let height = Math.round((this.voxelSize + (max.y - min.y)) * 100) / 100;;
        let depth = Math.round((this.voxelSize + (max.z - min.z)) * 100) / 100;

        let voxelGeometry = new BoxGeometry(width, height, depth);
        pos.divideScalar(i);

        const data = leaf.data.data[0]
        const rgb = data.color;
        if (rgb) {
          const count = voxelGeometry.attributes.position.count
          voxelGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3))
          for (let i = 0; i != count; i++) {
            voxelGeometry.attributes.color.setXYZ(i, rgb.r / 255, rgb.g / 255, rgb.b / 255)
          }
        }

        voxelGeometry.translate(pos.x, pos.y, pos.z);

        mergedGeometry = !mergedGeometry ? voxelGeometry : BufferGeometryUtils.mergeBufferGeometries([mergedGeometry, voxelGeometry])
        voxelGeometry.translate(-pos.x, -pos.y, -pos.z);
      }
    }

    mergedGeometry.computeFaceNormals();
    mergedGeometry.computeVertexNormals();

    var voxels = new Mesh(mergedGeometry, material);

    return voxels;
  }
}
