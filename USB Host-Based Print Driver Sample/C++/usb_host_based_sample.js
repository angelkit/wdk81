// THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY OF
// ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT LIMITED TO
// THE IMPLIED WARRANTIES OF MERCHANTABILITY AND/OR FITNESS FOR A
// PARTICULAR PURPOSE.
//
// Copyright (c) Microsoft Corporation. All rights reserved
//
// File Name:
//
//    usb_host_based_sample.js
//
// Abstract:
//
//    Sample Javascript host-based device script for v4 printer drivers.


// Add a reference that provides intellisense information for Windows 8 APIs.
/// <reference path="v4PrintDriver-Intellisense.js" />

// --------------------------------------------------------------------------
// Note: To disable intellisense for Windows 8.1 APIs, please delete the line below
/// <reference path="v4PrintDriver-Intellisense-Windows8.1.js" />
// --------------------------------------------------------------------------

function startPrintJob(usbJobContext, printerStream, printerBidiSchemaResponses) {
    ///<summary>
    ///     This method is invoked when the job starts printing.
    /// </summary>
    /// <param name="usbJobContext" type="IPrinterScriptUsbJobContext">
    ///    USB job context object.
    /// </param>
    /// <param name="printerStream" type="IPrinterScriptableSequentialStream">
    ///    Allows the script to Write/Read data from the attached USB device.
    /// </param>
    /// <param name="printerBidiSchemaResponses" type="IPrinterBidiSchemaResponses">
    ///    Object used by the script to store all status responses.
    /// </param>
    /// <returns type="IPrinterScriptUsbJobContextReturnCodes">
    ///     Returns one of the codes from the usbJobContext.ReturnCodes object.
    /// </returns>

    var retVal = usbJobContext.ReturnCodes.Success;
    var jobProperties = usbJobContext.jobPropertyBag;

    // Note: Attempting to retrieve job properties that don't exist will throw an exception.
    // If this failure is continuable, it should be caught and handled appropriately.
    try {
        var optionalValue = jobProperties.GetBool("Optional_Property");
    }
    catch (e)
    { /* Nothing to do. This 'Optional_Property' property isn't required to continue execution */ }

    // Determine if the device has a duplexing unit installed. This sample code assumes the device
    // cannot get into an error state.
    var duplexingUnitInstalled = deviceHelpers.isDuplexingUnitInstalled(printerStream);

    // Initialize the job properties. These are used from the writePrintData function
    jobProperties.SetBool("ManualDuplexJob", !duplexingUnitInstalled);
    jobProperties.SetBool("ManualDuplexBidiEventSent", false);
    jobProperties.SetInt32("PagesProcessed", 0);

    return retVal;
}

function writePrintData(usbJobContext, printData, printerStream, writePrintDataProgress, printerBidiSchemaResponses) {
    ///<summary>
    ///     This method is invoked when the data needs to be sent to the device
    /// </summary>
    /// <param name="usbJobContext" type="IPrinterScriptUsbJobContext">
    ///    USB job context object.
    /// </param>
    /// <param name="printData" type="Array">
    ///     Buffer containing data to be written to the device.
    /// </param>
    /// <param name="printerStream" type="IPrinterScriptableSequentialStream">
    ///     Allows the script to Write/Read data from the attached USB device.
    /// </param>
    /// <param name="writePrintDataProgress" type="IPrinterScriptUsbWritePrintDataProgress">
    ///     Allows the script to retrieve/update the count of bytes written to the device.
    /// </param>
    /// <param name="printerBidiSchemaResponses" type="IPrinterBidiSchemaResponses">
    ///    Object used by the script to store all status responses.
    /// </param>
    /// <returns type="IPrinterScriptUsbJobContextReturnCodes">
    ///     Returns one of the codes from the usbJobContext.ReturnCodes object.
    /// </returns>

    var retVal = usbJobContext.ReturnCodes.Success;
    var jobProperties = usbJobContext.jobPropertyBag;

    // This job property determines how many pages have been processed, to track odd/even pages
    // in a manually duplexed job. It does not reflect the number of pages sent to the device.
    var pagesProcessed = jobProperties.GetInt32("PagesProcessed");

    // Determines if the script needs to perform manual duplexing.
    var isManualDuplexJob = jobProperties.GetBool("ManualDuplexJob");

    var processedByteCount = 0;

    // Must be more than 2 bytes of data for a valid print stream
    if (printData.length < 2) {
        return usbJobContext.ReturnCodes.AbortTheJob;
    }

    // Find the page separator index in the current print data blob.
    var pageSeparatorIndex = deviceHelpers.findPageSeparatorIndex(printData, processedByteCount);

    // If there is no page separator marker in the input buffer, the length of the buffer is returned.
    var endOfPageFound = (pageSeparatorIndex < printData.length);

    // If a page marker was found before the end-of-data, increment the index by 2 so that
    // the page marker is also sent to the device
    if (endOfPageFound) {
        pageSeparatorIndex += 2;
    }

    // Slice one page of data from the input printData buffer.
    var pageData = printData.slice(processedByteCount, pageSeparatorIndex);

    // In a manually duplexed job, write even pages to the device, and odd pages to
    // a persistent stream for later processing during a call to endPrintJob.
    // Alternately, if this is an automatically duplexed job, write this data to the device directly.
    if ((pagesProcessed % 2 === 0) ||
        !isManualDuplexJob) {
        // Since this is an even page, write it to the device.
        processedByteCount = printerStream.Write(pageData);

        // If one entire page was written to the device, update the
        // 'IPrinterScriptUsbJobContext.PrintedPageCount' property. Else, this counter is
        // incremented in subsequent calls to the 'writePrintData' method.
        if (endOfPageFound &&
            processedByteCount === pageSeparatorIndex) {
            usbJobContext.PrintedPageCount++;
        }
    } else {
        // If this is an odd page, save the remaining bytes to a persistent stream
        // for later processing.
        processedByteCount =
            usbJobContext.TemporaryStreams[deviceHelpers.MANUAL_DUPLEX_STREAM].Write(pageData);
    }

    // If one page of data was found in the input buffer, and the entire page was
    // written, increment the processed page count. This counter is used to track odd/even
    // pages in a manually duplexed job.
    if (endOfPageFound &&
        processedByteCount === pageSeparatorIndex) {
        pagesProcessed++;
    }

    processedByteCount = pageSeparatorIndex;


    // Update the number of pages processed, for purpose of tracking odd/even pages.
    jobProperties.SetInt32("PagesProcessed", pagesProcessed);

    // Update 'IPrinterScriptUsbWritePrintDataProgress.ProcessedByteCount' property with the
    // number of bytes written, and USBMon will retry sending the rest of the buffer.
    writePrintDataProgress.ProcessedByteCount = processedByteCount;

    return retVal;
}

function endPrintJob(usbJobContext, printerStream, printerBidiSchemaResponses) {
    ///<summary>
    ///     This method is invoked when all the data to be written to the
    ///     device has been processed by the script.
    /// </summary>
    /// <param name="usbJobContext" type="IPrinterScriptUsbJobContext">
    ///    USB job context object.
    /// </param>
    /// <param name="printerStream" type="IPrinterScriptableSequentialStream">
    ///     Allows the script to Write/Read data from the attached USB device.
    /// </param>
    /// <param name="printerBidiSchemaResponses" type="IPrinterBidiSchemaResponses">
    ///    Object used by the script to store all status responses.
    /// </param>
    /// <returns type="IPrinterScriptUsbJobContextReturnCodes">
    ///     Returns one of the codes from the usbJobContext.ReturnCodes object.
    /// </returns>

    var retVal = usbJobContext.ReturnCodes.Success;
    var jobProperties = usbJobContext.jobPropertyBag;

    // Determines if the script needs to perform manual duplexing.
    var isManualDuplexJob = jobProperties.GetBool("ManualDuplexJob");

    // Is this a Manual duplex job (which implies pages stored in the 
    //  alternate persistent data stream
    if (isManualDuplexJob) {
        // Bubble up a Bidi event, that pops a toast, requesting the user to flip the pages.
        if (!jobProperties.GetBool("ManualDuplexBidiEventSent")) {
            printerBidiSchemaResponses.AddNull("\\Printer.Extension:ManualDuplexEvent");

            // Ensure the bidi event is not sent twice.
            jobProperties.SetBool("ManualDuplexBidiEventSent", true);
            retVal = usbJobContext.ReturnCodes.Retry;
        } else if (!deviceHelpers.isDeviceReadyForDuplexData(printerStream)) {

            // If the device hasn't been readied to receive duplex data, request USBMon to retry
            // this function after a short period of time.
            retVal = usbJobContext.ReturnCodes.Retry;
        } else {

            // If the device is ready to receive duplex data, try sending it one page of data.
            // If the device is unable to receive the entire page of data, store the unsent data
            // in a temporary stream and request USBMon to retry invoking this function.
            // On subsequent invocations, previously unwritten data from the temporary stream
            // will be written to the device before any new data from the manual duplex stream is
            // written out.

            retVal = usbJobContext.ReturnCodes.Retry;

            // Attempt to read data to previously unwritten data from the temporary stream. If
            // there is no such data, fresh data from the manual duplex stream is read.
            var streamsToRead = [deviceHelpers.UNWRITTEN_DATA_STREAM, deviceHelpers.MANUAL_DUPLEX_STREAM];
            var dataToWrite = null;

            for (var i = 0; i < streamsToRead.length; i++) {
                dataToWrite = usbJobContext.TemporaryStreams[streamsToRead[i]].Read(32768);

                if (dataToWrite &&
                    dataToWrite.length > 0) {
                    break;
                }
            }

            // If there is no data left to send in either stream, the job is complete.
            if (!dataToWrite ||
                dataToWrite.length === 0) {
                return usbJobContext.ReturnCodes.Success;
            }

            // Attempt to find a page separator index in the data.
            var pageSeparatorIndex = deviceHelpers.findPageSeparatorIndex(dataToWrite, 0);

            // If there is no page separator marker in the input buffer,
            // the length of the buffer is retured.
            var endOfPageFound = (pageSeparatorIndex < dataToWrite.length);

            // If a page marker was found before the end-of-data, increment the index by 2 so that
            // the page marker is also sent to the device
            if (endOfPageFound) {
                pageSeparatorIndex += 2;
            }

            var pageData = dataToWrite.slice(0, pageSeparatorIndex);

            // Try to write certain bytes to a device. If all of the data couldn't be written,
            // save it to a temporary stream.
            var bytesWritten = printerStream.Write(pageData);

            // If all the data in the buffer couldn't be written, either because the script only
            // sent data up to the page boundary, or because the device couldn't receive one page
            // of data, then store the data in a temporary buffer to be written to the device in
            // subsequent calls.
            if (bytesWritten < dataToWrite.length) {
                var unWrittenData = dataToWrite.slice(bytesWritten);

                var unwrittenSize =
                    usbJobContext.TemporaryStreams[deviceHelpers.UNWRITTEN_DATA_STREAM].Write(unWrittenData);

                // If the unwritten data couldn't be stored in the temporary stream,
                // this is an unrecoverable failure.
                if (unwrittenSize !== unWrittenData.length) {
                    retVal = usbJobContext.ReturnCodes.Failure;
                }
            }

            // If the entire buffer up to the page boundary was written,
            // increment the printed page count
            if (bytesWritten === pageSeparatorIndex &&
                endOfPageFound) {
                usbJobContext.PrintedPageCount++;
            }
        }
    }
    else {
        // Nothing to do for an automatically duplexed job.
    }

    return retVal;
}

var deviceHelpers = {
    isDuplexingUnitInstalled: function (printerStream) {
        /// <summary>
        ///     Query the device to determine if a duplexer unit
        ///     has been installed on the device.
        /// </summary>
        /// <param name="printerStream" type="IPrinterScriptableSequentialStream">
        ///    Allows the script to Write/Read data from the attached USB device.
        /// </param>
        /// <returns type="Boolean">
        ///     true - A duplexing unit has been installed on the device
        ///     false - A duplexing unit has not been installed on the device.
        ///             This script must perform manual duplexing
        /// </returns>
        var checkDuplexCommand = [0x0D, 0x0D, 0x02, 0xCA, 0xFE];

        // Ignore error handling because this check is device-specific.
        if (printerStream.Write(checkDuplexCommand)) {
            var response = printerStream.Read(1);
            if (response &&
                response[0] === 1) {
                return true;
            }
        }

        return false;
    },
    isDeviceReadyForDuplexData: function (printerStream) {
        /// <summary>
        ///     In a manual duplex job, queries the device to determine if the user has
        ///     flipped over printed pages and readied the device to receive manually
        ///     duplexed pages (such as by pressing a button).
        /// </summary>
        /// <param name="printerStream" type="IPrinterScriptableSequentialStream">
        ///    Allows the script to Write/Read data from the attached USB device.
        /// </param>
        /// <returns type="Boolean">
        ///     true - The user has flipped over the pages, and pressed a button on the device
        ///     false - The device is not ready to receive data yet
        /// </returns>
        var setDeviceManualDuplex = [0x58, 0x85];
        printerStream.Write(setDeviceManualDuplex);

        var deviceStatus = printerStream.Read(64);

        // Ignore error handling because this check is device-specific.
        if (deviceStatus &&
            deviceStatus.length >= 2 &&
            deviceStatus[0] === 0x1c && deviceStatus[1] === 0x02) {
            return true;
        } else {
            return false;
        }
    },
    findPageSeparatorIndex: function (buffer, startIndex) {
        /// <summary>
        ///     Retrieves the index in the input buffer at which the page separator
        ///     marker is located.
        /// </summary>
        /// <param name="buffer" type="Array">
        ///     Input data buffer
        /// </param>
        /// <param name="startIndex" type="Number" integer="true">
        ///     The index in the buffer from which the search begins
        /// </param>
        /// <returns type="Number" integer="true">
        ///     The index at which the PDL's page separator marker is located. Returns the
        ///     length of the input buffer if marker is not found in the buffer.
        /// </returns>

        // Note: The page separator marker used below has a two-byte signature of '0x5c, 0x72'
        var pageSeparatorMarker = [0x5c, 0x72];

        // Iterate through the input buffer to determine if there is a page separator marker.
        for (var i = startIndex; i < buffer.length - 1; i += pageSeparatorMarker.length) {
            var firstChar = buffer[i];
            var secondChar = buffer[i + 1];

            // Verify if the page separator marker is found at the current location.
            if (firstChar === pageSeparatorMarker[0]) {
                if (secondChar === pageSeparatorMarker[1]) {
                    return i;
                }
            }

            // If the second character being compared matches the first character of the
            // page separator maker, it is possible the second character could be the
            // beginning of a separator marker.
            if (secondChar === pageSeparatorMarker[0]) {
                i--;
            }
        }

        // No page separator marker was found in the input buffer.
        return buffer.length;
    },
    /// <summary>Represents the stream index where unwritten data is stored. </summary>
    UNWRITTEN_DATA_STREAM: 0,
    /// <summary>Represents the stream index where manually duplexed data it stored </summary>
    MANUAL_DUPLEX_STREAM: 1
};
