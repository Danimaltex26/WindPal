/**
 * Compress and resize an image file before upload.
 * Returns a new File object under the size limit.
 *
 * @param {File} file - Original image file
 * @param {object} opts
 * @param {number} opts.maxWidth - Max pixel width (default 1600)
 * @param {number} opts.maxHeight - Max pixel height (default 1600)
 * @param {number} opts.quality - JPEG quality 0-1 (default 0.8)
 * @returns {Promise<File>}
 */
export function compressImage(file, opts) {
  var maxWidth = (opts && opts.maxWidth) || 1600;
  var maxHeight = (opts && opts.maxHeight) || 1600;
  var quality = (opts && opts.quality) || 0.8;

  return new Promise(function (resolve, reject) {
    // If already small enough (<1MB), skip compression
    if (file.size < 1024 * 1024) {
      return resolve(file);
    }

    var img = new Image();
    var reader = new FileReader();

    reader.onload = function (e) {
      img.onload = function () {
        var w = img.width;
        var h = img.height;

        // Scale down if needed
        if (w > maxWidth || h > maxHeight) {
          var ratio = Math.min(maxWidth / w, maxHeight / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          function (blob) {
            if (!blob) return reject(new Error('Compression failed'));
            var compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = function () { reject(new Error('Failed to load image')); };
      img.src = e.target.result;
    };
    reader.onerror = function () { reject(new Error('Failed to read file')); };
    reader.readAsDataURL(file);
  });
}

/**
 * Compress multiple files.
 * @param {FileList|File[]} files
 * @param {object} opts
 * @returns {Promise<File[]>}
 */
export async function compressImages(files, opts) {
  var result = [];
  for (var i = 0; i < files.length; i++) {
    result.push(await compressImage(files[i], opts));
  }
  return result;
}
