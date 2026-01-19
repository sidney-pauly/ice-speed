/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Soup from "gi://Soup";
import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import { makeFetch } from './gjs-fetch.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const ICE_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-GB,en;q=0.5',
    'Connection': 'keep-alive',
    'Host': ' iceportal.de',
    'Priority': 'u=0, i',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': ' Mozilla/5.0 (X11; Linux x86_64; rv:146.0) Gecko/20100101 Firefox/146.0'
}

let global_error = 'All fine'

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(extensionObject) {
        super._init(Clutter.ActorAlign.FILL);
        const path = extensionObject.path;
        //const settings = extensionObject.getSettings();

        // Create a Soup session
        const session = new Soup.Session();

        // Create a fetch function 
        const fetch = makeFetch(session);

        const train_label = new St.Label({
            text: 'starting...',
            y_align: Clutter.ActorAlign.CENTER
        })
        const speed_label = new St.Label({
            text: 'starting...',
            y_align: Clutter.ActorAlign.CENTER
        })
        const stop_label = new St.Label({
            text: 'starting...',
            y_align: Clutter.ActorAlign.CENTER
        })
        const stop_time_label = new St.Label({
            text: 'starting...',
            y_align: Clutter.ActorAlign.CENTER
        })
        // attempt to prevent ellipsizes
        train_label.get_clutter_text().ellipsize = 0;
        speed_label.get_clutter_text().ellipsize = 0;
        //stop_label.get_clutter_text().ellipsize = 0;
        stop_time_label.get_clutter_text().ellipsize = 0;

        const icon = new St.Icon({
            reactive: true,
            style_class: 'system-status-icon'
        })
        icon.set_icon_size(16);
        // start off with DB for now
        icon.gicon = Gio.icon_new_for_string(`${path}` + '/icons' + '/db.svg');

        const speed_icon = new St.Icon({
            // icon_name: 'speedometer5-symbolic',
            style_class: 'system-status-icon',
        });
        const stop_icon = new St.Icon({
            // icon_name: 'arrow3-right-symbolic',
            style_class: 'system-status-icon',
        });
        const stop_time_icon = new St.Icon({
            icon_name: 'org.gnome.Settings-time-symbolic',
            style_class: 'system-status-icon',
        });
        speed_icon.gicon = Gio.icon_new_for_string(`${path}` + '/icons' + '/speedometer5-symbolic.svg');
        stop_icon.gicon = Gio.icon_new_for_string(`${path}` + '/icons' + '/arrow3-right-symbolic.svg');
        stop_time_icon.set_icon_size(16);
        speed_icon.set_icon_size(16);
        stop_icon.set_icon_size(16);

        
        const box = new St.BoxLayout({
            vertical: false,
            clip_to_allocation: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: true,
            x_expand: true
        });
        box.spacing = 5;

        let test = false;

        box.add_child(icon);
        box.add_child(train_label);
        box.add_child(speed_icon);
        box.add_child(speed_label);
        box.add_child(stop_time_icon);
        box.add_child(stop_time_label);
        box.add_child(stop_icon);
        box.add_child(stop_label);
        test = true;

        this.add_child(box)

        let mode = 'disconnected'

        async function updateLabel(){

            if(mode == 'ICE' || mode == 'disconnected'){

                const success = await updateICE()

                if(success)
                    mode = 'ICE'
                else
                    mode = 'disconnected'

            }

            if(mode == 'RailJet' || mode == 'disconnected'){

                const success = await updateRailjet()

                if(success)
                    mode = 'RailJet'
                else
                    mode = 'disconnected'
            }

            setTimeout(updateLabel, 1000)
        }

        setTimeout(updateLabel, 1000);

        let item = new PopupMenu.PopupMenuItem(_('Show problem'));
        item.connect('activate', () => {
            Main.notify(_(`Error: ${global_error}`));
        });
        let test_item = new PopupMenu.PopupMenuItem(_('Toggle Next Station'));
        test_item.connect('activate', () => {
            if (test) {
                box.remove_child(stop_icon);
                box.remove_child(stop_label);
                test = false;
            } else {
                box.add_child(stop_icon);
                box.add_child(stop_label);
                test = true;
            };
        });
        this.menu.addMenuItem(item);
        this.menu.addMenuItem(test_item);

        async function updateICE() {

            try {
                const reqSpeed = fetch('https://iceportal.de/api1/rs/status', {headers: ICE_HEADERS});
                const reqStatus = fetch('https://iceportal.de/api1/rs/tripInfo/trip', {headers: ICE_HEADERS});

                const resSpeed = await reqSpeed;
                const resStatus = await reqStatus;

                const dataSpeed = await resSpeed.json();
                const dataStatus = await resStatus.json();
                const speed = dataSpeed.speed;
                const trainInfo = dataStatus.trip.journeyDisplayValue;

                const nextStop = dataStatus.trip.stops.find(s => s.station.evaNr == dataStatus.trip.stopInfo.actualNext)

                const nextStopTime = new Date(nextStop.timetable.actualArrivalTime)
                const nextStopTimeFormatted = nextStopTime.toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})

                global_error = undefined;
                train_label.text = `${trainInfo}`;
                speed_label.text = `${speed} km/h`;
                stop_label.text = `${nextStop.station.name}`;
                stop_time_label.text = `${nextStopTimeFormatted}`;

                // update icon if changed
                if(mode != 'ICE'){
                    icon.gicon = Gio.icon_new_for_string(`${path}` + '/icons' + '/db.svg');
                }

                return true
                // error = 'All fine'
            }
            catch (error) {
                global_error = error.toString();
                //label.text = `${error}`;
                return false
            }
        }

        async function updateRailjet(){

            try {

                const res = await fetch('https://railnet.oebb.at/assets/media/fis/combined.json')
                const json = await res.json()
                
                const speed = json.latestStatus.speed
                const train = `${json.trainType} ${json.lineNumber}`

                const nextStationArrival = (!!json.nextStation.arrival.forecast) ? json.nextStation.arrival.forecast : json.nextStation.arrival.scheduled  
                const nextStop = json.nextStation.name.de
                
                global_error = undefined;
                train_label.text = `${train}`;
                speed_label.text = `${speed} km/h`;
                stop_label.text = `${nextStop}`;
                stop_time_label.text = `${nextStationArrival}`;

                // update icon if changed
                if(mode != 'RailJet'){
                    icon.gicon = Gio.icon_new_for_string(`${path}` + '/icons' + '/oebb.svg');
                }

                return true
            }
            catch(e){
                global_error = error.toString();
                //label.text = `${error}`;
                return false
            }

        }
    }

    
});

export default class IndicatorExampleExtension extends Extension {
    enable() {
        this._indicator = new Indicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}