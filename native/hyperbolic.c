/* Browser-facing adapter for SnapPea's double-precision kernel. */
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>
#include "kernel.h"
#include "unix_file_io.h"

extern Triangulation *DT_int_to_triangulation(int, int *);
static TriangulationData *canonical_data = NULL;
void browser_capture_canonical(Triangulation *manifold) {
    if (canonical_data) free_triangulation_data(canonical_data);
    triangulation_to_data(manifold, &canonical_data);
}
static void canonical_json(FILE *out) {
    int t, f, v;
    fputs(",\"triangulation\":[", out);
    for (t = 0; canonical_data && t < canonical_data->num_tetrahedra; t++) {
        TetrahedronData *d = &canonical_data->tetrahedron_data[t];
        fprintf(out, "%s{\"neighbors\":[%d,%d,%d,%d],\"cusps\":[%d,%d,%d,%d],\"gluings\":[",
            t ? "," : "", d->neighbor_index[0], d->neighbor_index[1], d->neighbor_index[2], d->neighbor_index[3],
            d->cusp_index[0], d->cusp_index[1], d->cusp_index[2], d->cusp_index[3]);
        for (f = 0; f < 4; f++) {
            fprintf(out, "%s[", f ? "," : "");
            for (v = 0; v < 4; v++) fprintf(out, "%s%d", v ? "," : "", d->gluing[f][v]);
            fputc(']', out);
        }
        fputs("]}", out);
    }
    fputc(']', out);
}

static void complex_json(FILE *out, Complex z) {
    fprintf(out, "[%.15g,%.15g]", z.real, z.imag);
}
static void segments_json(FILE *out, CuspNbhdSegmentList *list) {
    int i;
    fputc('[', out);
    if (list) for (i = 0; i < list->num_segments; i++) {
        CuspNbhdSegment *s = &list->segment[i];
        if (i) fputc(',', out);
        fputs("{\"a\":", out); complex_json(out, s->endpoint[0]);
        fputs(",\"b\":", out); complex_json(out, s->endpoint[1]);
        fprintf(out, ",\"labels\":[%d,%d,%d]}", s->start_index, s->middle_index, s->end_index);
    }
    fputc(']', out);
    if (list) free_cusp_neighborhood_segment_list(list);
}
static void word_json(FILE *out, int *word) {
    int i;
    fputc('[', out);
    for (i = 0; word[i]; i++) fprintf(out, "%s%d", i ? "," : "", word[i]);
    fputc(']', out);
    fg_free_relation(word);
}

int main(int argc, char **argv) {
    int n, id, i, dt[50], solution, mode;
    double cutoff;
    FILE *in, *out;
    Triangulation *m;
    if (argc < 4) return 2;
    mode = atoi(argv[1]);
    cutoff = argc > 4 ? atof(argv[4]) : 0.15;
    if (cutoff < 0.03 || cutoff > 1) cutoff = 0.15;
    in = fopen(argv[2], "r");
    if (mode == 5) {
        KLPProjection p;
        int c, s, d, h, neighbor, strand;
        if (!in || fscanf(in, "%d%d%d", &p.num_crossings, &p.num_components, &p.num_free_loops) != 3
            || p.num_crossings < 0 || p.num_crossings > 49 || p.num_components < 1 || p.num_components > 49) return 2;
        p.crossings = calloc(p.num_crossings + 1, sizeof(KLPCrossing));
        for (c = 0; c < p.num_crossings; c++) {
            if (fscanf(in, "%d%d%d", &h, &p.crossings[c].component[0], &p.crossings[c].component[1]) != 3) return 2;
            p.crossings[c].handedness = h;
            for (s = 0; s < 2; s++) for (d = 0; d < 2; d++) {
                if (fscanf(in, "%d%d", &neighbor, &strand) != 2 || neighbor < 0 || neighbor >= p.num_crossings || strand < 0 || strand > 1) return 2;
                p.crossings[c].neighbor[s][d] = &p.crossings[neighbor];
                p.crossings[c].strand[s][d] = strand;
            }
        }
        fclose(in);
        m = triangulate_link_complement(&p, 1);
        free(p.crossings);
        if (!m) return 3;
        set_triangulation_name(m, "LinkSmith browser drawing");
        find_complete_hyperbolic_structure(m);
        i = write_triangulation(m, argv[3]);
        free_triangulation(m);
        return i ? 0 : 3;
    }
    if (!in || fscanf(in, "%d%d", &n, &id) != 2 || n < 3 || n > 49) return 2;
    for (i = 0; i < n; i++) if (fscanf(in, "%d", &dt[i]) != 1) return 2;
    fclose(in);
    m = DT_int_to_triangulation(n, dt);
    if (!m) return 3;
    set_triangulation_name(m, "KnotScape browser");
    if (mode != 4) find_complete_hyperbolic_structure(m);
    if (mode == 3) {
        i = write_triangulation(m, argv[3]);
        free_triangulation(m);
        return i ? 0 : 3;
    }
    out = fopen(argv[3], "w");
    solution = get_complete_solution_type(m);
    fprintf(out, "{\"solutionType\":%d,\"tetrahedra\":%d", solution, get_num_tetrahedra(m));
    if (mode == 4) {
        GroupPresentation *g = fundamental_group(m, 1, 1, 1, 1);
        fprintf(out, ",\"generators\":%d,\"relations\":[", fg_get_num_generators(g));
        for (i = 0; i < fg_get_num_relations(g); i++) {
            if (i) fputc(',', out);
            word_json(out, fg_get_relation(g, i));
        }
        fputs("],\"meridian\":", out); word_json(out, fg_get_meridian(g, 0));
        fputs(",\"longitude\":", out); word_json(out, fg_get_longitude(g, 0));
        free_group_presentation(g);
    } else if (solution == geometric_solution || solution == nongeometric_solution) {
        int precision;
        double vol = volume(m, &precision);
        fprintf(out, ",\"volume\":%.15g,\"precisionDigits\":%d", vol, precision);
        if (mode == 0 || mode == 2) {
            CuspNeighborhoods *c = initialize_cusp_neighborhoods(m);
            if (c) {
                Complex meridian, longitude;
                CuspNbhdHoroballList *balls;
                set_cusp_neighborhood_displacement(c, 0, get_cusp_neighborhood_stopping_displacement(c, 0));
                get_cusp_neighborhood_translations(c, 0, &meridian, &longitude);
                fprintf(out, ",\"cuspVolume\":%.15g,\"meridian\":", get_cusp_neighborhood_cusp_volume(c, 0));
                complex_json(out, meridian);
                fputs(",\"longitude\":", out); complex_json(out, longitude);
                if (mode == 2) {
                    balls = get_cusp_neighborhood_horoballs(c, 0, 1, cutoff);
                    fputs(",\"horoballs\":[", out);
                    if (balls) for (i = 0; i < balls->num_horoballs; i++) {
                        if (i) fputc(',', out);
                        fprintf(out, "[%.15g,%.15g,%.15g]", balls->horoball[i].center.real, balls->horoball[i].center.imag, balls->horoball[i].radius);
                    }
                    fputc(']', out);
                    if (balls) free_cusp_neighborhood_horoball_list(balls);
                    fputs(",\"canonical\":", out);
                    segments_json(out, get_cusp_neighborhood_triangulation(c, 0));
                    fputs(",\"ford\":", out);
                    segments_json(out, get_cusp_neighborhood_Ford_domain(c, 0));
                }
                free_cusp_neighborhoods(c);
            }
        }
        if (mode == 1) {
            SymmetryGroup *group = NULL, *link = NULL;
            Triangulation *symmetric = NULL;
            Boolean full;
            if (compute_symmetry_group(m, &group, &link, &symmetric, &full) == func_OK) {
                IsometryList *isometries = get_symmetry_list(group);
                fprintf(out, ",\"symmetry\":{\"order\":%d,\"linkOrder\":%d,\"dihedral\":%s,\"amphicheiral\":%s,\"invertible\":%s,\"isometries\":[",
                    symmetry_group_order(group), symmetry_group_order(link),
                    symmetry_group_is_dihedral(group) ? "true" : "false",
                    symmetry_group_is_amphicheiral(group) ? "true" : "false",
                    symmetry_group_invertible_knot(group) ? "true" : "false");
                for (i = 0; i < isometry_list_size(isometries); i++) {
                    int image, a[2][2];
                    isometry_list_cusp_action(isometries, i, 0, &image, a);
                    fprintf(out, "%s{\"order\":%d,\"extendsToLink\":%s,\"cuspAction\":[[%d,%d],[%d,%d]],\"tetrahedra\":[",
                        i ? "," : "", symmetry_group_order_of_element(group, i),
                        isometry_extends_to_link(isometries, i) ? "true" : "false",
                        a[0][0], a[0][1], a[1][0], a[1][1]);
                    {
                        Isometry *iso = isometries->isometry[i];
                        int t, v;
                        for (t = 0; t < iso->num_tetrahedra; t++) {
                            fprintf(out, "%s[%d", t ? "," : "", iso->tet_image[t]);
                            for (v = 0; v < 4; v++) fprintf(out, ",%d", EVALUATE(iso->tet_map[t], v));
                            fputc(']', out);
                        }
                        fputs("]}", out);
                    }
                }
                fputc(']', out);
                canonical_json(out);
                fputc('}', out);
                if (symmetric) free_triangulation(symmetric);
                free_symmetry_group(group);
                free_symmetry_group(link);
            }
        }
    }
    fputs("}", out);
    fclose(out);
    free_triangulation(m);
    return 0;
}
