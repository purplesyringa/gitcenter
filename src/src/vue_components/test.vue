<template>
    <p>Test object</p>
</template>

<script>
    var Router = require("../libs/router.js");

    module.exports = {
        props: [],
        name: 'test',
        mounted: function() {
            console.log("Hello world!");
        }
    }
</script>