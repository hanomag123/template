"use strict";

const { src, dest } = require("gulp");
const gulp = require("gulp");
const autoprefixer = require("gulp-autoprefixer");
const cssbeautify = require("gulp-cssbeautify");
const removeComments = require("gulp-strip-css-comments");
const rename = require("gulp-rename");
const sass = require("gulp-sass")(require("sass"));
const cssnano = require("gulp-cssnano");
const rigger = require("gulp-rigger");
const plumber = require("gulp-plumber");
const panini = require("panini");
const imagemin = require("gulp-imagemin");
const del = require("del");
const browserSync = require("browser-sync").create();
const purgecss = require("gulp-purgecss");
const fileInclude = require('gulp-file-include');
const pug = require('gulp-pug');
const argv = require('yargs').argv;
const footer = require('gulp-footer');
const postcss = require('gulp-postcss');
const postcssDiscardComments = require('postcss-discard-comments');

// CSS splitting libraries
const groupCssMediaQueries = require('gulp-group-css-media-queries');
const through2 = require('through2');
const cssParser = require('css');
const pathModule = require('path');

/* Paths */
const srcPath = "src/";
const distPath = "dist/";
const path = {
  build: {
    html: distPath,
    js: distPath + "js/",
    css: distPath + "css/",
    images: distPath + "images/",
    fonts: distPath + "fonts/",
    vendorcss: distPath + "css/vendor/",
    video: distPath + "video/",
  },
  src: {
    html: srcPath + "*.html",
    js: srcPath + "assets/js/*.js",
    css: srcPath + "assets/scss/*.scss",
    vendorcss: srcPath + "assets/js/components/*.css",
    pug: srcPath + "*.pug",
    video: distPath + "assets/video/",
    images:
      srcPath +
      "assets/images/**/*.{jpg,png,svg,gif,ico,webp,webmanifest,xml,json}",
    fonts: srcPath + "assets/fonts/**/*.{eot,woff,woff2,ttf,svg}",
  },
  watch: {
    html: srcPath + "**/*.html",
    js: srcPath + "assets/js/**/*.js",
    css: srcPath + "assets/scss/**/*.scss",
    vendorcss: srcPath + "assets/js/components/*.css",
    pug: srcPath + "*.pug",
    images:
      srcPath +
      "assets/images/**/*.{jpg,png,svg,gif,ico,webp,webmanifest,xml,json}",
    fonts: srcPath + "assets/fonts/**/*.{eot,woff,woff2,ttf,svg}",
  },
  clean: "./" + distPath,
};

// Custom plugin to split CSS - creates adaptive.css ONLY for style.scss
function splitCssDirect() {
  return through2.obj(function(file, enc, cb) {
    if (file.isNull()) {
      return cb(null, file);
    }
    
    if (file.isStream()) {
      return cb(new Error('Streaming not supported'));
    }
    
    try {
      const contents = file.contents.toString();
      const ast = cssParser.parse(contents);
      const fileName = pathModule.basename(file.path, '.css');
      const isMainStyle = fileName === 'style' || file.path.includes('style.css');
      
      let baseRules = [];
      let mediaRules = [];
      
      ast.stylesheet.rules.forEach(rule => {
        if (rule.type === 'media') {
          mediaRules.push(rule);
        } else {
          baseRules.push(rule);
        }
      });
      
      if (isMainStyle) {
        // For main style.scss file - create style.css and adaptive.css
        if (baseRules.length > 0) {
          const baseFile = file.clone();
          baseFile.path = file.path.replace(/[^/\\]*$/, 'style.css');
          baseFile.contents = Buffer.from(cssParser.stringify({
            type: 'stylesheet',
            stylesheet: { rules: baseRules }
          }));
          this.push(baseFile);
        }
        
        // Create adaptive.css (only media queries) - ONLY for style.scss
        if (mediaRules.length > 0) {
          const mediaFile = file.clone();
          mediaFile.path = file.path.replace(/[^/\\]*$/, 'adaptive.css');
          mediaFile.contents = Buffer.from(cssParser.stringify({
            type: 'stylesheet',
            stylesheet: { rules: mediaRules }
          }));
          this.push(mediaFile);
        }
      } else {
        // For other SCSS files (like hello.scss) - create only {filename}.css with ALL styles
        // This includes both base and media queries in one file
        const outputFile = file.clone();
        outputFile.path = file.path.replace(/[^/\\]*$/, fileName + '.css');
        outputFile.contents = Buffer.from(cssParser.stringify({
          type: 'stylesheet',
          stylesheet: { rules: [...baseRules, ...mediaRules] }
        }));
        this.push(outputFile);
      }
      
      cb();
      
    } catch (err) {
      cb(err);
    }
  });
}

/* Tasks */

function serve() {
  browserSync.init({
    server: {
      baseDir: "./" + distPath,
    },
  });
}

function html(cb) {
  panini.refresh();
  return src(path.src.html, { base: srcPath })
    .pipe(plumber())
    .pipe(
      panini({
        root: srcPath,
        layouts: srcPath + "layouts/",
        partials: srcPath + "partials/",
        helpers: srcPath + "helpers/",
        data: srcPath + "data/",
      })
    )
    .pipe(fileInclude({
      prefix: '@',
      basepath: '@file',
    }))
    .pipe(dest(path.build.html))
    .pipe(browserSync.reload({ stream: true }));
}

function pugs(cb) {
  return src(path.src.pug, { base: srcPath })
    .pipe(pug())
    .pipe(dest(path.build.html))
    .pipe(browserSync.reload({ stream: true }));
}

// Main CSS build task - processes all SCSS files
function buildCss(cb) {
  return src(path.src.css, { base: srcPath + "assets/scss/" })
    .pipe(
      sass({
        includePaths: "./node_modules/",
      }).on('error', sass.logError)
    )
    .pipe(
      autoprefixer({
        cascade: true,
      })
    )
    .pipe(cssbeautify())
    .pipe(removeComments())
    // Group media queries together
    .pipe(groupCssMediaQueries())
    // Split directly into appropriate files based on filename
    .pipe(splitCssDirect())
    .pipe(dest(path.build.css))
    .pipe(browserSync.reload({ stream: true }));
}

// Watch task for CSS - reuses buildCss
function cssWatch(cb) {
  return buildCss(cb);
}

function vendorcss(cb) {
  return src(path.src.vendorcss, { base: srcPath + "assets/js/components/" })
    .pipe(dest(path.build.vendorcss));
}

function cleanCss(cb) {
  return src(path.src.css, { base: srcPath + "assets/scss/" })
    .pipe(
      sass({
        includePaths: "./node_modules/",
      }).on('error', sass.logError)
    )
    .pipe(
      purgecss({
        content: ["src/**/*.{html,js,php}"],
        safelist: ['hello'],
        defaultExtractor: (content) => {
          const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
          const innerMatches =
            content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];
          return broadMatches.concat(innerMatches);
        },
      })
    )
    .pipe(cssbeautify())
    .pipe(
      cssnano({
        zindex: false,
        discardComments: {
          removeAll: true,
        },
      })
    )
    .pipe(removeComments())
    .pipe(groupCssMediaQueries())
    .pipe(splitCssDirect())
    .pipe(dest(path.build.css))
    .pipe(browserSync.reload({ stream: true }));
}

function js(cb) {
  return src(path.src.js, { base: srcPath + "assets/js/" })
    .pipe(rigger())
    .pipe(dest(path.build.js))
    .pipe(browserSync.reload({ stream: true }));
}

function jsWatch(cb) {
  return src(path.src.js, { base: srcPath + "assets/js/" })
    .pipe(rigger())
    .pipe(dest(path.build.js))
    .pipe(browserSync.reload({ stream: true }));
}

function images(cb) {
  return src(path.src.images)
    .pipe(
      imagemin([
        imagemin.gifsicle({ interlaced: true }),
        imagemin.mozjpeg({ quality: 95, progressive: true }),
        imagemin.optipng({ optimizationLevel: 5 }),
        imagemin.svgo({
          plugins: [{ removeViewBox: true }, { cleanupIDs: false }],
        }),
      ])
    )
    .pipe(dest(path.build.images))
    .pipe(browserSync.reload({ stream: true }));
}

function imagesWatch(cb) {
  return src(path.src.images)
    .pipe(dest(path.build.images))
    .pipe(browserSync.reload({ stream: true }));
}

function fonts(cb) {
  return src(path.src.fonts)
    .pipe(dest(path.build.fonts))
    .pipe(browserSync.reload({ stream: true }));
}

function clean(cb) {
  return del(path.clean);
}

function cleanWithoutImg(cb) {
  return del([
    'dist/**/fonts/**',
    'dist/**/css/**',
    'dist/**/js/**',
    'dist/index.html'
  ], { force: true });
}

function newFile() {
  if (argv.file?.length) {
    const arr = argv.file.split(' ');
    arr.forEach(element => {
      src('src/assets/empty.html')
        .pipe(rename(() => {
          return {
            dirname: '.',
            basename: element,
            extname: '.html',
          };
        }))
        .pipe(dest('src'), { overwrite: false, append: true });
      
      src('src/assets/empty.html')
        .pipe(rename(() => {
          return {
            dirname: '.',
            basename: element,
            extname: '.scss',
          };
        }))
        .pipe(dest('src/assets/scss/blocks'), { overwrite: false, append: true });
    });
    return Promise.resolve('значение игнорируется');
  } else if (argv.vendor?.length) {
    const arr = argv.vendor.split(' ');
    arr.forEach(element => {
      src('src/assets/empty.html')
        .pipe(rename(() => {
          return {
            dirname: '.',
            basename: element,
            extname: '.scss',
          };
        }))
        .pipe(dest('src/assets/scss/vendor'), { overwrite: false, append: true });
    });
    return Promise.resolve('значение игнорируется');
  } else {
    return Promise.resolve('значение игнорируется');
  }
}

function toEnd() {
  if (argv.file?.length) {
    const arr = argv.file.split(' ');
    
    gulp.src('src/assets/scss/_importsBlocks.scss')
      .pipe(footer(arr.map(el => ' @import \'./blocks/' + el + '.scss\';').join(' ')))
      .pipe(cssbeautify())
      .pipe(gulp.dest('src/assets/scss/'), { overwrite: true, append: false });
    
    gulp.src('src/index.html')
      .pipe(footer(arr.map(el => `\n<li><a href="${el}.html" class="_progress__link">${el}</a></li>`).join(' ')))
      .pipe(gulp.dest('src/'), { overwrite: true, append: false });
    
    return Promise.resolve('значение игнорируется');
  } else if (argv.vendor?.length) {
    const arr = argv.vendor.split(' ');
    
    gulp.src('src/assets/scss/importsVendors.scss')
      .pipe(footer(arr.map(el => ' @import \'./vendor/' + el + '.scss\';').join(' ')))
      .pipe(cssbeautify())
      .pipe(gulp.dest('src/assets/scss/'), { overwrite: true, append: false });
    
    return Promise.resolve('значение игнорируется');
  } else {
    return Promise.resolve('значение игнорируется');
  }
}

function imagesWithoutMin() {
  return src(path.src.images)
    .pipe(dest(path.build.images))
    .pipe(browserSync.reload({ stream: true }));
}

function watchFiles() {
  gulp.watch([path.watch.html], gulp.series(html));
  gulp.watch([path.watch.css], cssWatch);
  gulp.watch([path.watch.js], gulp.series(jsWatch));
  gulp.watch([path.watch.images], gulp.series(imagesWatch));
  gulp.watch([path.watch.fonts], gulp.series(fonts));
}

// Build tasks
const buildOld = gulp.series(
  clean,
  gulp.parallel(html, buildCss, vendorcss, js, images, fonts)
);

const start = gulp.series(
  cleanWithoutImg,
  gulp.parallel(html, buildCss, js, fonts)
);

const watch = gulp.series(start, gulp.parallel(watchFiles, serve));
const build = gulp.parallel(buildOld, watchFiles, serve);
const buildCleanCSS = gulp.series(
  clean,
  gulp.parallel(html, cleanCss, js, images, fonts)
);
const create = gulp.series(gulp.parallel(newFile, toEnd));
const buildNMin = gulp.series(
  clean,
  html,
  buildCss,
  js,
  imagesWithoutMin,
  fonts
);

/* Exports Tasks */
exports.create = create;
exports.html = html;
exports.css = buildCss;
exports.js = js;
exports.images = images;
exports.fonts = fonts;
exports.clean = clean;
exports.build = build;
exports.watch = watch;
exports.default = watch;
exports.cleanWithoutImg = cleanWithoutImg;
exports.start = start;
exports.buildCleanCSS = buildCleanCSS;
exports.buildNMin = buildNMin;